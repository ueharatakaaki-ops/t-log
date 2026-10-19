"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRoleLanding } from "@/lib/auth/role-landing";
import {
  classifyVerifyError,
  computeLinkDiagnostics,
  isIOS,
  type LinkDiagnostics,
} from "@/lib/auth/link-diagnostics";
import { sendAuthLog } from "@/lib/client/auth-log";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * 招待メール・パスワードリセットメールの正式な受け皿。
 *
 * 以前はサーバー側のRoute Handlerで、GETされた時点で即座にverifyOtp()を
 * 実行していた。しかしこれだと、Safari/iOSのMail・リンクプレビュー機能や、
 * 一部のメールセキュリティ製品によるリンクの事前スキャンが、本人が実際に
 * タップするより先にこのURLへアクセスしてしまい、使い捨てトークンを
 * 誤って消費してしまう問題があった（本人が開いた時には「無効なリンク」に
 * なり、ログイン画面に弾かれる）。
 *
 * これを避けるため、GETされただけでは何もせず、本人が明示的にボタンを
 * 押したタイミングでのみ verifyOtp() を呼ぶクライアントコンポーネントに
 * 変更した。プレビュー機能はページを静的に読み込むだけでボタンを押す
 * ことはないため、トークンが誤って消費されなくなる。
 *
 * Supabaseのメールテンプレート側は、{{ .ConfirmationURL }} ではなく
 * このページを指す形（{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...）
 * にしておくこと（docs/auth-email-templates.md）。
 *
 * token_hash と type だけで動く（next は任意。無い・不正なら /auth/set-password）。
 * アプリ内ブラウザやリンクの破損で進めない人のために、メールの確認コードで続ける
 * /auth/code への導線を常に出しておく。
 */
type ConfirmParams = {
  tokenHash: string | null;
  type: EmailOtpType | null;
  next: string;
};

type Status = "idle" | "pending" | "network_error" | "invalid" | "error" | "bad_link";

const DEFAULT_NEXT = "/auth/set-password";
const VERIFY_TIMEOUT_MS = 20_000;
const VALID_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "signup", "email", "email_change"];

/**
 * next クエリパラメータをそのまま window.location.href に代入すると、
 * ?next=https://evil.example や ?next=javascript:... のようなリンクを
 * 第三者が作れてしまい、オープンリダイレクト（フィッシング等の踏み台）になる。
 *
 * 文字列の先頭（"/"始まり・"//"は除く、等）だけを見て判定すると、
 * "/\evil.example"（ブラウザがバックスラッシュをスラッシュとして解釈する）や
 * タブ・改行を挟んだ文字列（URL解釈時に取り除かれる）ですり抜けられてしまう
 * （ローカルのClaude Codeの指摘により発覚）。
 * そのため、実際にブラウザが行うのと同じURL解釈を new URL() に行わせたうえで、
 * 解決後のoriginが自サイトと一致する場合だけ許可する。
 *
 * 戻り値は pathname+search+hash を文字列連結したものではなく、必ず
 * parsed.href（origin一致を確認済みの絶対URL）を返すこと。連結した文字列を
 * window.location.href に代入すると、その文字列が改めてブラウザに解釈され
 * 直される。"/.//evil.example" のような入力は、new URL()の時点では
 * originが自サイトのまま正規化されるが、pathnameだけ取り出すと
 * "//evil.example" になり、代入時にプロトコル相対URLとして外部サイトに
 * 飛んでしまう（ローカルのClaude Codeの指摘により発覚）。href全体を
 * 返せば、この二重解釈の余地がなくなる。
 */
function sanitizeNext(rawNext: string | null): string {
  if (!rawNext) return DEFAULT_NEXT;
  try {
    const parsed = new URL(rawNext, window.location.origin);
    if (parsed.origin !== window.location.origin) return DEFAULT_NEXT;
    return parsed.href;
  } catch {
    return DEFAULT_NEXT;
  }
}

/** 応答が返らないまま固まるのを防ぐ（通信失敗として扱い、もう一度押せるようにする） */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("verify timeout");
      err.name = "VerifyTimeoutError";
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export default function AuthConfirmPage() {
  const [params, setParams] = useState<ConfirmParams | null>(null);
  const [diagnostics, setDiagnostics] = useState<LinkDiagnostics | null>(null);
  const [onIOS, setOnIOS] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get("token_hash");
    const rawType = url.searchParams.get("type");
    const type = VALID_TYPES.includes(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null;
    const rawNext = url.searchParams.get("next");
    const next = sanitizeNext(rawNext);

    const diag = computeLinkDiagnostics({ tokenHash, hasNext: rawNext !== null, userAgent: navigator.userAgent });
    setDiagnostics(diag);
    setOnIOS(isIOS(navigator.userAgent));
    sendAuthLog({ event: "confirm_view", diagnostics: diag });

    if (!tokenHash || !type) setStatus("bad_link");
    setParams({ tokenHash, type, next });
  }, []);

  async function handleConfirm() {
    if (!params?.tokenHash || !params.type) return;
    setStatus("pending");
    setErrorDetail(null);

    const supabase = createClient();
    let error: { name?: string; status?: number; code?: string; message?: string } | null;
    try {
      ({ error } = await withTimeout(
        supabase.auth.verifyOtp({ type: params.type, token_hash: params.tokenHash }),
        VERIFY_TIMEOUT_MS
      ));
    } catch (e) {
      // fetch 自体の例外・タイムアウト（supabase-js が error として返さなかったもの）
      error = { name: e instanceof Error ? e.name : "Error", message: e instanceof Error ? e.message : "" };
    }

    if (!error) {
      sendAuthLog({ event: "confirm_success", diagnostics: diagnostics ?? undefined });
      // Cookie同期を確実にするためフルページ遷移にする（他の画面と同じ理由）
      window.location.href = params.next;
      return;
    }

    const kind = classifyVerifyError(error);
    sendAuthLog({
      event: "confirm_error",
      diagnostics: diagnostics ?? undefined,
      error: { name: error.name, status: error.status, code: error.code },
    });

    if (kind === "network") {
      // 通信できなかった場合はトークンが消費されていないことがあるため、そのまま押し直せるようにする
      setStatus("network_error");
      return;
    }

    // すでにこのブラウザで確認済み（別タブ等ですでにセッションが確立している）
    // 場合は、エラー画面を見せずそのまま普段の画面へ送ってあげる
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: appUser } = await supabase
        .from("app_users")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      window.location.href = getRoleLanding(appUser?.role);
      return;
    }

    // 通信失敗・端末側の問題・本当の期限切れを区別できるよう、原因調査に必要な情報だけを小さく表示する。
    // token_hash・URL・メールアドレスは含めない（message に混ざりうるURLのクエリ文字列も除去する）。
    // 時刻はボタン押下後にクライアント側でのみ生成するが、error.tsx と同様に suppressHydrationWarning を付けておく。
    const occurredAt = new Date().toLocaleTimeString("sv-SE", { timeZone: "Asia/Tokyo" });
    const message = (error.message ?? "").replace(/\?\S*/g, "").slice(0, 80);
    const diag = diagnostics
      ? ` / h${diagnostics.hashLength}${diagnostics.hashFormatOk ? "" : "!"}${diagnostics.inAppBrowser ? ` / ${diagnostics.inAppBrowser}` : ""}`
      : "";
    const detail = `詳細: ${error.name ?? "-"} / ${error.status ?? "-"} / ${error.code ?? "-"} / ${message}${diag} / ${occurredAt}`;
    console.error("verifyOtp failed", detail);

    setErrorDetail(detail);
    setStatus(kind === "invalid_or_expired" ? "invalid" : "error");
  }

  const isRecovery = params?.type === "recovery";
  const label = isRecovery ? "パスワードを再設定する" : "パスワードを設定する";
  const codeHref = params?.type === "recovery" || params?.type === "invite" ? `/auth/code?type=${params.type}` : "/auth/code";
  const showButton = status === "idle" || status === "pending" || status === "network_error";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F8] px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-1 text-2xl font-bold text-[#0F2537]">t-log</h1>

        {diagnostics?.inAppBrowser && <InAppBrowserNotice browser={onIOS ? "Safari" : "Chrome"} />}

        {showButton ? (
          <>
            <p className="mb-8 mt-6 text-sm leading-relaxed text-slate-500">
              下のボタンを押して、{isRecovery ? "パスワードの再設定" : "アカウントの利用開始"}に進んでください。
            </p>
            {status === "network_error" && (
              <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-800">
                通信できませんでした。もう一度ボタンを押してください。
              </p>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!params?.tokenHash || !params.type || status === "pending"}
              className="h-12 w-full rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:opacity-60"
            >
              {status === "pending" ? "確認中..." : label}
            </button>
          </>
        ) : (
          <div role="alert">
            <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm font-medium leading-relaxed text-rose-700">
              {status === "bad_link"
                ? "無効なリンクです。招待メール・パスワード再設定メールのリンクからもう一度お試しください。"
                : status === "invalid"
                  ? "このリンクはすでに使用されたか、有効期限が切れています。"
                  : "確認できませんでした。時間をおいてもう一度お試しください。"}
            </p>
            {(status === "invalid" || status === "bad_link") && (
              <>
                <Link
                  href={codeHref}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#0F2537] text-base font-bold text-white"
                >
                  メールに書かれたコードで続ける
                </Link>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  コードでも進めない場合は、お手数ですが管理者に再度招待（またはパスワード再設定）を依頼してください。
                </p>
              </>
            )}
            {errorDetail && (
              <p className="mt-3 break-all text-xs text-slate-400" suppressHydrationWarning>
                {errorDetail}
              </p>
            )}
          </div>
        )}

        <p className="mt-10 text-sm">
          <Link href={codeHref} className="font-semibold text-[#00A859] underline">
            メールのコードで続ける
          </Link>
        </p>
      </div>
    </main>
  );
}

/**
 * LINE・キャリアのメールアプリ等に埋め込まれたブラウザで開かれた場合の注意。
 * ボタンはそのまま使える（判定は UA による推測なので、誤判定でも操作は止めない）。
 */
function InAppBrowserNotice({ browser }: { browser: "Safari" | "Chrome" }) {
  const [copied, setCopied] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showUrl) urlRef.current?.select();
  }, [showUrl]);

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // クリップボードが使えない環境では、URL を選択状態で表示して手動でコピーしてもらう
      setShowUrl(true);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm leading-relaxed text-amber-900">
      <p className="font-bold">アプリ内のブラウザで開いています</p>
      <p className="mt-1">
        このまま開けない場合は、右下（または右上）のメニューから『{browser}で開く』を選ぶか、下の『リンクをコピー』を押して、{browser} に貼り付けてください。
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 h-10 w-full rounded-lg border border-amber-400 bg-white text-sm font-semibold text-amber-900"
      >
        {copied ? "コピーしました" : "リンクをコピー"}
      </button>
      {showUrl && (
        <input
          ref={urlRef}
          readOnly
          aria-label="このページのリンク"
          value={typeof window === "undefined" ? "" : window.location.href}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-slate-700"
        />
      )}
    </div>
  );
}
