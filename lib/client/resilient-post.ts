// 電波が不安定な端末向けの、打ち切り＋自動再試行つき POST。
//
// モバイル回線では、放置後に切れた接続に乗った POST が、応答も失敗通知も返らないまま
// 止まることがある（POST はブラウザが自動再送しない）。1回の試行を自分で打ち切り、
// 安全なものだけ自動で再試行する。送信先は同じ内容が二重に届いても問題ない（冪等な）
// API であること（例: POST /api/daily-log は player_id + log_date の upsert）。
//
// 古い端末でも動くよう、標準的な API だけを使う（AbortSignal.timeout・crypto.randomUUID・
// navigator.connection 等には依存しない）。

export type AttemptResult = "ok" | "timeout" | "network_error" | `http_${number}`;

export type AttemptRecord = { n: number; ms: number; result: AttemptResult };

export type ResilientPostOutcome<T> =
  // 2xx
  | { kind: "ok"; status: number; data: T | null; attempts: AttemptRecord[] }
  // 再試行しない HTTP エラー（400・401・403・409 など）。サーバーのメッセージを表示する
  | { kind: "http_error"; status: number; data: T | null; attempts: AttemptRecord[] }
  // 再試行できる失敗が最後まで続いた（ネットワークエラー・タイムアウト・408・429・5xx）
  | { kind: "gave_up"; attempts: AttemptRecord[] };

export type ResilientPostOptions = {
  /** 1回の試行の上限（ミリ秒）。既定 8 秒 */
  timeoutMs?: number;
  /** 各試行の前に待つ時間。要素数が最大試行回数になる。既定 [0, 1000, 3000]（合計でおおよそ30秒以内） */
  delaysMs?: number[];
  /** 各試行を始める直前に呼ばれる（画面に「再試行しています(2/3)」を出すため） */
  onAttempt?: (n: number, total: number) => void;
  /** テスト用の差し替え */
  fetchImpl?: typeof fetch;
};

export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_DELAYS_MS = [0, 1_000, 3_000];

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class AttemptTimeout extends Error {}

type AttemptResponse<T> = { status: number; ok: boolean; data: T | null };

// 1回分の試行。応答本文の読み込みまで含めて timeoutMs で打ち切る
function attemptOnce<T>(
  url: string,
  body: string,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<AttemptResponse<T>> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;

  return new Promise<AttemptResponse<T>>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // AbortController が無い古い端末では通信自体は止められないが、結果は待たずに次へ進む
      if (controller) controller.abort();
      reject(new AttemptTimeout());
    }, timeoutMs);

    const run = async (): Promise<AttemptResponse<T>> => {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      });
      let data: T | null = null;
      try {
        data = (await res.json()) as T;
      } catch (e) {
        // 打ち切りによる中断は呼び出し元でタイムアウトとして扱う。それ以外（HTMLのエラーページ等）は本文なし
        if (settled) throw e;
      }
      return { status: res.status, ok: res.ok, data };
    };

    run().then(
      (r) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function now(): number {
  return Date.now();
}

export async function resilientPostJson<T = unknown>(
  url: string,
  payload: unknown,
  options: ResilientPostOptions = {}
): Promise<ResilientPostOutcome<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const delaysMs = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const body = JSON.stringify(payload);
  const total = delaysMs.length;
  const attempts: AttemptRecord[] = [];

  for (let i = 0; i < total; i++) {
    if (delaysMs[i] > 0) await wait(delaysMs[i]);
    const n = i + 1;
    if (options.onAttempt) options.onAttempt(n, total);

    const startedAt = now();
    try {
      const res = await attemptOnce<T>(url, body, timeoutMs, fetchImpl);
      const ms = now() - startedAt;
      if (res.ok) {
        attempts.push({ n, ms, result: "ok" });
        return { kind: "ok", status: res.status, data: res.data, attempts };
      }
      attempts.push({ n, ms, result: `http_${res.status}` });
      if (!isRetryableStatus(res.status)) {
        return { kind: "http_error", status: res.status, data: res.data, attempts };
      }
    } catch (e) {
      attempts.push({ n, ms: now() - startedAt, result: e instanceof AttemptTimeout ? "timeout" : "network_error" });
    }
  }

  return { kind: "gave_up", attempts };
}

/**
 * 切れた接続を作り直すきっかけにするための、軽い疎通確認（結果は使わない）。
 * 画面が再び見えたとき・オンラインに戻ったときに呼ぶ。
 */
export async function pingConnection(url = "/api/ping", timeoutMs = 3_000): Promise<void> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => {
    if (controller) controller.abort();
  }, timeoutMs);
  try {
    await Promise.race([
      fetch(url, { method: "GET", cache: "no-store", signal: controller ? controller.signal : undefined }),
      wait(timeoutMs),
    ]);
  } catch {
    // 結果は無視する
  } finally {
    clearTimeout(timer);
  }
}
