// 招待・パスワード再設定リンク（/auth/confirm）とコード入力（/auth/code）で使う判定処理。
// 画面に依存しない純粋関数だけを置く（tests/unit/link-diagnostics.test.ts で検証する）。
//
// 診断情報には、トークン本体・メールアドレス・URL を含めない。
// 「リンクが途中で壊れたのか」「アプリ内ブラウザだったのか」を後から切り分けるための最小限の値だけを持つ。

export type InAppBrowserKind = "line" | "facebook" | "instagram" | "docomo" | "ios-webview" | "android-webview";

export type LinkDiagnostics = {
  hashLength: number;
  /** 英数字のみか（Supabase の token_hash は 16進数の56文字。途中で切れたり記号が混ざると false/長さ違いになる） */
  hashFormatOk: boolean;
  hasNext: boolean;
  inAppBrowser: InAppBrowserKind | null;
};

/**
 * アプリ内ブラウザ（LINE・Facebook・Instagram・キャリアのメールアプリ等）かどうかを UA から緩めに判定する。
 * 誤判定しても注意文が出る／出ないだけで、ボタンの動作は止めない前提。
 */
export function detectInAppBrowser(ua: string): InAppBrowserKind | null {
  if (/\bLine\//i.test(ua)) return "line";
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return "facebook";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/docomo/i.test(ua)) return "docomo";

  const isIOS = /iPhone|iPad|iPod/.test(ua);
  // iOS の Safari・Chrome(CriOS)・Firefox(FxiOS)・Edge(EdgiOS) はいずれも "Safari/" を含む。
  // 含まないものは、アプリに埋め込まれた WebView の可能性が高い。
  if (isIOS && !/Safari\//.test(ua)) return "ios-webview";

  // Android の WebView は "; wv)" を含む
  if (/Android/.test(ua) && /;\s*wv\)/.test(ua)) return "android-webview";

  return null;
}

export function isIOS(ua: string): boolean {
  return /iPhone|iPad|iPod/.test(ua);
}

export function computeLinkDiagnostics(params: { tokenHash: string | null; hasNext: boolean; userAgent: string }): LinkDiagnostics {
  const hash = params.tokenHash ?? "";
  return {
    hashLength: hash.length,
    hashFormatOk: hash.length > 0 && /^[A-Za-z0-9]+$/.test(hash),
    hasNext: params.hasNext,
    inAppBrowser: detectInAppBrowser(params.userAgent),
  };
}

/** メールに書かれた確認コード（Supabase の設定で6〜10桁。現在の設定は8桁）として受け付ける桁数 */
export const OTP_MIN_LENGTH = 6;
export const OTP_MAX_LENGTH = 10;

/**
 * 入力された確認コードを正規化する。全角数字は半角に、空白（全角スペース含む）・ハイフンは除去する。
 * 数字以外が残る、または桁数が範囲外なら null。
 */
export function normalizeOtpCode(input: string): string | null {
  const halfWidth = input.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const compact = halfWidth.replace(/[\s　\-ー－]/g, "");
  if (!/^\d+$/.test(compact)) return null;
  if (compact.length < OTP_MIN_LENGTH || compact.length > OTP_MAX_LENGTH) return null;
  return compact;
}

export type VerifyErrorKind = "network" | "invalid_or_expired" | "other";

/**
 * verifyOtp のエラーを、画面の出し分け用に分類する。
 * - network: 通信できなかった（トークンは消費されていない可能性があるため、もう一度押せるようにする）
 * - invalid_or_expired: トークンが見つからない・期限切れ・使用済み（リンクが壊れている場合もここに入る）
 */
export function classifyVerifyError(error: { name?: string; status?: number; code?: string; message?: string }): VerifyErrorKind {
  if (error.name === "AuthRetryableFetchError" || error.name === "VerifyTimeoutError" || error.status === 0) {
    return "network";
  }
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (
    code === "otp_expired" ||
    code === "otp_disabled" ||
    error.status === 403 ||
    /not found|expired|invalid/.test(message)
  ) {
    return "invalid_or_expired";
  }
  return "other";
}
