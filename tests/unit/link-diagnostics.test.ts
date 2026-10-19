// lib/auth/link-diagnostics.ts と lib/date.ts の formatJstDateTime の単体テスト（npm test で実行）。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyVerifyError,
  computeLinkDiagnostics,
  detectInAppBrowser,
  normalizeOtpCode,
} from "@/lib/auth/link-diagnostics";
import { formatJstDateTime } from "@/lib/date";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  iosLine:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0",
  iosWebView:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  // 永井さんの端末と同じ形（"Mobile/15E148" も "Safari/" も無く、末尾が docomo01）
  docomo: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) docomo01",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0",
  facebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

test("通常のブラウザはアプリ内ブラウザと判定しない", () => {
  assert.equal(detectInAppBrowser(UA.iosSafari), null);
  assert.equal(detectInAppBrowser(UA.iosChrome), null);
  assert.equal(detectInAppBrowser(UA.androidChrome), null);
  assert.equal(detectInAppBrowser(UA.desktopChrome), null);
});

test("アプリ内ブラウザを種類ごとに判定する", () => {
  assert.equal(detectInAppBrowser(UA.iosLine), "line");
  assert.equal(detectInAppBrowser(UA.docomo), "docomo");
  assert.equal(detectInAppBrowser(UA.iosWebView), "ios-webview");
  assert.equal(detectInAppBrowser(UA.androidWebView), "android-webview");
  assert.equal(detectInAppBrowser(UA.instagram), "instagram");
  assert.equal(detectInAppBrowser(UA.facebook), "facebook");
});

test("診断情報: token_hash の長さ・形式・next の有無だけを持つ", () => {
  const ok = computeLinkDiagnostics({ tokenHash: "a".repeat(56), hasNext: false, userAgent: UA.iosSafari });
  assert.deepEqual(ok, { hashLength: 56, hashFormatOk: true, hasNext: false, inAppBrowser: null });

  const broken = computeLinkDiagnostics({ tokenHash: "abc%20def", hasNext: true, userAgent: UA.docomo });
  assert.deepEqual(broken, { hashLength: 9, hashFormatOk: false, hasNext: true, inAppBrowser: "docomo" });

  const missing = computeLinkDiagnostics({ tokenHash: null, hasNext: false, userAgent: "" });
  assert.equal(missing.hashLength, 0);
  assert.equal(missing.hashFormatOk, false);
});

test("確認コード: 全角数字・前後や途中の空白・ハイフンを正規化する", () => {
  assert.equal(normalizeOtpCode("12345678"), "12345678");
  assert.equal(normalizeOtpCode("  12345678 "), "12345678");
  assert.equal(normalizeOtpCode("１２３４５６７８"), "12345678");
  assert.equal(normalizeOtpCode("　１２３４ ５６７８\n"), "12345678");
  assert.equal(normalizeOtpCode("1234-5678"), "12345678");
  assert.equal(normalizeOtpCode("123456"), "123456");
});

test("確認コード: 数字以外・桁数が範囲外なら null", () => {
  assert.equal(normalizeOtpCode(""), null);
  assert.equal(normalizeOtpCode("12345"), null);
  assert.equal(normalizeOtpCode("12345678901"), null);
  assert.equal(normalizeOtpCode("1234567a"), null);
});

test("verifyOtp のエラー分類", () => {
  assert.equal(classifyVerifyError({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" }), "network");
  assert.equal(classifyVerifyError({ name: "VerifyTimeoutError" }), "network");
  assert.equal(
    classifyVerifyError({ name: "AuthApiError", status: 403, code: "otp_expired", message: "Email link is invalid or has expired" }),
    "invalid_or_expired"
  );
  assert.equal(
    classifyVerifyError({ name: "AuthApiError", status: 403, message: "One-time token not found" }),
    "invalid_or_expired"
  );
  assert.equal(classifyVerifyError({ name: "AuthApiError", status: 500, message: "Database error" }), "other");
});

test("formatJstDateTime: 日本時間の M/D HH:mm、無ければ「なし」", () => {
  assert.equal(formatJstDateTime("2026-10-20T12:05:00Z"), "10/20 21:05");
  assert.equal(formatJstDateTime("2026-10-20T15:00:00Z"), "10/21 00:00");
  assert.equal(formatJstDateTime(null), "なし");
  assert.equal(formatJstDateTime("not a date"), "なし");
});
