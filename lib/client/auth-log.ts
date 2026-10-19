// 招待・再設定リンクまわりの診断情報を POST /api/auth-log に送る（次回の原因確定用）。
// 送るのは診断情報だけ（トークン本体・メールアドレス・URL は送らない）。
//
// 記録先のテーブル（auth_link_events）はマイグレーション適用後に使えるようになるため、
// それまでは NEXT_PUBLIC_AUTH_LOG_ENABLED=1 を設定しない限り何も送らない。
// 送信の失敗は画面の動作に影響させない（結果を待たず、例外も握りつぶす）。
import type { LinkDiagnostics } from "@/lib/auth/link-diagnostics";

export type AuthLogEvent =
  | "confirm_view"
  | "confirm_success"
  | "confirm_error"
  | "code_success"
  | "code_error";

export type AuthLogPayload = {
  event: AuthLogEvent;
  diagnostics?: Partial<LinkDiagnostics>;
  error?: { name?: string; status?: number; code?: string };
};

export function isAuthLogEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_LOG_ENABLED === "1";
}

export function sendAuthLog(payload: AuthLogPayload): void {
  if (!isAuthLogEnabled()) return;
  try {
    const body = JSON.stringify({
      event: payload.event,
      ...payload.diagnostics,
      errorName: payload.error?.name,
      errorStatus: payload.error?.status,
      errorCode: payload.error?.code,
    });
    void fetch("/api/auth-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // 記録に失敗しても登録の流れは止めない
  }
}
