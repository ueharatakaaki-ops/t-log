"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRoleLanding } from "@/lib/auth/role-landing";
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
 * にしておくこと。
 */
type ConfirmParams = {
  tokenHash: string | null;
  type: EmailOtpType | null;
  next: string;
};

const DEFAULT_NEXT = "/auth/set-password";

/**
 * next クエリパラメータをそのまま window.location.href に代入すると、
 * ?next=https://evil.example や ?next=javascript:... のようなリンクを
 * 第三者が作れてしまい、オープンリダイレクト（フィッシング等の踏み台）になる。
 * 自サイト内の相対パス（"/"始まり・"//"は除く）だけを許可する。
 */
function sanitizeNext(rawNext: string | null): string {
  if (!rawNext) return DEFAULT_NEXT;
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return DEFAULT_NEXT;
  return rawNext;
}

export default function AuthConfirmPage() {
  const [params, setParams] = useState<ConfirmParams | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") as EmailOtpType | null;
    const next = sanitizeNext(url.searchParams.get("next"));

    if (!tokenHash || !type) {
      setStatus("error");
      setErrorMessage("無効なリンクです。招待メール・パスワード再設定メールのリンクからもう一度お試しください。");
    }
    setParams({ tokenHash, type, next });
  }, []);

  async function handleConfirm() {
    if (!params?.tokenHash || !params.type) return;
    setStatus("pending");
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type: params.type, token_hash: params.tokenHash });

    if (!error) {
      // Cookie同期を確実にするためフルページ遷移にする（他の画面と同じ理由）
      window.location.href = params.next;
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

    setStatus("error");
    setErrorMessage(
      "このリンクはすでに使用されたか、有効期限が切れています。お手数ですが、管理者に再度招待（またはパスワード再設定）を依頼してください。"
    );
  }

  const isRecovery = params?.type === "recovery";
  const label = isRecovery ? "パスワードを再設定する" : "パスワードを設定する";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F8] px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-1 text-2xl font-bold text-[#0F2537]">t-log</h1>

        {status === "error" ? (
          <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm font-medium leading-relaxed text-rose-700">
            {errorMessage}
          </p>
        ) : (
          <>
            <p className="mb-8 text-sm leading-relaxed text-slate-500">
              下のボタンを押して、{isRecovery ? "パスワードの再設定" : "アカウントの利用開始"}に進んでください。
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!params?.tokenHash || !params.type || status === "pending"}
              className="h-12 w-full rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:opacity-60"
            >
              {status === "pending" ? "確認中..." : label}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
