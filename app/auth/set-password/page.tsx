"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LANDING } from "@/lib/auth/role-landing";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("パスワードは8文字以上で設定してください");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    // ボタンのdisabled制御と二重のチェック（フォームの他の要素からの
    // submitや将来の実装変更で誤って素通りしないようにするための保険）
    if (!agreed) {
      setError("利用規約とプライバシーポリシーへの同意が必要です");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("パスワードの設定に失敗しました。招待リンクの有効期限が切れている可能性があります。");
        return;
      }

      const { data } = await supabase.auth.getUser();
      const { data: appUser } = await supabase
        .from("app_users")
        .select("role")
        .eq("id", data.user?.id ?? "")
        .single();

      const landing = appUser?.role ? ROLE_LANDING[appUser.role] ?? "/" : "/";
      // ログイン画面と同じ理由で、Cookie同期を確実にするためフルページ遷移にする
      window.location.href = landing;
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F8] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#0F2537]">t-log</h1>
        <p className="mb-8 text-center text-sm text-slate-500">はじめてのログイン — パスワードを設定してください</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新しいパスワード（8文字以上）"
            required
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#0F2537]"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="新しいパスワード（確認）"
            required
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#0F2537]"
          />

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300"
            />
            <span>
              <Link href="/terms" target="_blank" className="font-medium text-[#0F2537] underline">
                利用規約
              </Link>
              {"と"}
              <Link href="/privacy" target="_blank" className="font-medium text-[#0F2537] underline">
                プライバシーポリシー
              </Link>
              {"に同意します"}
            </span>
          </label>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={isPending || !agreed}
            className="h-12 rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:opacity-60"
          >
            {isPending ? "設定中..." : "パスワードを設定してはじめる"}
          </button>
        </form>
      </div>
    </main>
  );
}
