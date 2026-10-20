// 日次ログ送信の経過を POST /api/client-log に送る（「送信できなかった」報告の原因確認用）。
// 送るのは結果・各試行・きっかけだけ（入力内容は送らない）。
//
// 記録先のテーブル（client_submit_logs）はマイグレーション適用後に使えるようになるため、
// それまでは NEXT_PUBLIC_CLIENT_LOG_ENABLED=1 を設定しない限り何も送らない。
// 送信の失敗は画面の動作に影響させない（結果を待たず、例外も握りつぶす）。
import type { AttemptRecord } from "@/lib/client/resilient-post";

export type SubmitTrigger = "button" | "online" | "visible";

export type ClientSubmitLog = {
  kind: "daily_log";
  outcome: "ok" | "http_error" | "gave_up";
  httpStatus?: number;
  attempts: AttemptRecord[];
  trigger: SubmitTrigger;
  logDate?: string;
};

export function isClientLogEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLIENT_LOG_ENABLED === "1";
}

export function sendClientLog(log: ClientSubmitLog): void {
  if (!isClientLogEnabled()) return;
  try {
    const body = JSON.stringify({
      ...log,
      attempts: log.attempts.slice(0, 10).map((a) => ({ n: a.n, ms: Math.round(a.ms), result: a.result })),
      online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    });
    void fetch("/api/client-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      cache: "no-store",
    }).catch(() => {});
  } catch {
    // 記録に失敗しても送信の流れは止めない
  }
}
