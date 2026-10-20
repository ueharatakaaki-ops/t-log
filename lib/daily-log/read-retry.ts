// 日次ログ画面の読み込み（既存の記録・記録済みの日）を、一時的な失敗のときだけ数回やり直す。
//
// 読み込みに失敗したまま「記録なし」として空のフォームを出すと、選手は未入力だと思って入力し直し、
// 送信（player_id + log_date の upsert）で入力済みの内容を上書きしてしまう。
// そのため、やり直しても失敗する場合は例外を投げ、選手画面のエラー表示（再読み込みボタン）に任せる。

export type ReadResult<T> = { data: T; error: { code?: string; message: string } | null };

export const DEFAULT_READ_DELAYS_MS = [0, 300, 1000];

export class DailyLogReadError extends Error {
  constructor(label: string, code: string | undefined) {
    super(`${label} failed${code ? ` (${code})` : ""}`);
    this.name = "DailyLogReadError";
  }
}

export async function withReadRetry<T>(
  label: string,
  run: () => PromiseLike<ReadResult<T>>,
  delaysMs: number[] = DEFAULT_READ_DELAYS_MS
): Promise<T> {
  let lastError: ReadResult<T>["error"] = null;
  for (let i = 0; i < delaysMs.length; i++) {
    if (delaysMs[i] > 0) await new Promise((resolve) => setTimeout(resolve, delaysMs[i]));
    let result: ReadResult<T>;
    try {
      result = await run();
    } catch (e) {
      result = { data: null as T, error: { message: e instanceof Error ? e.message : String(e) } };
    }
    if (!result.error) return result.data;
    lastError = result.error;
    console.error(`${label} failed (attempt ${i + 1}/${delaysMs.length})`, result.error.code, result.error.message);
  }
  throw new DailyLogReadError(label, lastError?.code);
}
