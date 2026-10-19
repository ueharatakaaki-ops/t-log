"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { classifyVerifyError, normalizeOtpCode, OTP_MAX_LENGTH, OTP_MIN_LENGTH } from "@/lib/auth/link-diagnostics";
import { sendAuthLog } from "@/lib/client/auth-log";

/**
 * メールのリンクが開けない（リンクが壊れた・アプリ内ブラウザ等）場合に、
 * メール本文の確認コードとメールアドレスで登録・再設定を続けるための画面。
 *
 * 招待メールか再設定メールかは画面からは分からないため、invite → recovery の順に試す
 * （/auth/confirm から来た場合は、リンクの type を先に試す）。
 * コードの総当たりは Supabase 側の回数制限で防がれるが、何度も失敗している人には
 * それ以上試させず、管理者への連絡を案内する。
 */
type OtpType = "invite" | "recovery";

const FAILURES_BEFORE_HELP = 3;

export default function AuthCodePage() {
  // 入力欄は非制御にする（表示が遅い端末で、画面の準備完了前に入力した内容が消えないように）。
  // 準備完了（ready）までは送信ボタンを押せなくし、ブラウザ標準の送信でメールアドレスが URL に載るのを防ぐ。
  const [ready, setReady] = useState(false);
  const [typeOrder, setTypeOrder] = useState<OtpType[]>(["invite", "recovery"]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);

  useEffect(() => {
    const hint = new URL(window.location.href).searchParams.get("type");
    if (hint === "recovery") setTypeOrder(["recovery", "invite"]);
    setReady(true);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const trimmedEmail = String(form.get("email") ?? "").trim();
    const token = normalizeOtpCode(String(form.get("code") ?? ""));
    if (!trimmedEmail) {
      setError("メールアドレスを入力してください");
      return;
    }
    if (!token) {
      setError(`コードは、メールに書かれた${OTP_MIN_LENGTH}〜${OTP_MAX_LENGTH}桁の数字を入力してください`);
      return;
    }

    setPending(true);
    const supabase = createClient();
    let lastError: { name?: string; status?: number; code?: string; message?: string } | null = null;
    for (const type of typeOrder) {
      let result;
      try {
        result = await supabase.auth.verifyOtp({ email: trimmedEmail, token, type });
      } catch (err) {
        result = { error: { name: err instanceof Error ? err.name : "Error", message: "" } };
      }
      if (!result.error) {
        sendAuthLog({ event: "code_success" });
        // Cookie同期を確実にするためフルページ遷移にする（他の画面と同じ理由）
        window.location.href = "/auth/set-password";
        return;
      }
      lastError = result.error;
      // 通信できない場合は、別の type を試しても同じなのでここで止める
      if (classifyVerifyError(result.error) === "network") break;
    }
    setPending(false);

    sendAuthLog({
      event: "code_error",
      error: { name: lastError?.name, status: lastError?.status, code: lastError?.code },
    });
    if (lastError && classifyVerifyError(lastError) === "network") {
      setError("通信できませんでした。電波の良い場所で、もう一度お試しください。");
      return;
    }
    setFailures((n) => n + 1);
    setError("メールアドレスまたはコードが違う、または期限切れです");
  }

  const needsHelp = failures >= FAILURES_BEFORE_HELP;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F8] px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#0F2537]">t-log</h1>
        <p className="mb-8 text-center text-sm leading-relaxed text-slate-500">
          招待メール（またはパスワード再設定メール）に書かれた確認コードを入力してください
        </p>

        {needsHelp ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-medium leading-relaxed text-rose-700">
            何度か続けて確認できませんでした。コードの期限が切れている可能性があります。
            お手数ですが、管理者（コーチ・スクール）に連絡して、登録用のリンクを作り直してもらってください。
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-[#0F2537]">
              メールアドレス
              <input
                type="email"
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                required
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base font-normal outline-none focus:border-[#0F2537]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-[#0F2537]">
              確認コード（数字）
              <input
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={24}
                required
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base font-normal tracking-widest outline-none focus:border-[#0F2537]"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm font-medium text-rose-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!ready || pending}
              className="h-12 rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:opacity-60"
            >
              {pending ? "確認中..." : "続ける"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
