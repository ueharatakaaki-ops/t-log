"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

// ロールごとのログイン後の遷移先。/loginは唯一の未認証アクセス許可パスなので、
// ここでの分岐がその後の導線を決める。
const ROLE_LANDING: Record<string, string> = {
  player: "/daily-log",
  coach: "/dashboard",
  parent: "/reports",
  school_admin: "/admin/users",
  system_admin: "/admin/users",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !data.user) {
        setError("メールアドレスまたはパスワードが違います");
        return;
      }

      const { data: appUser } = await supabase
        .from("app_users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const landing = appUser?.role ? ROLE_LANDING[appUser.role] ?? "/" : "/";
      // router.push（ページを読み込み直さない軽い画面遷移）だと、ログインで
      // 発行されたCookieがサーバー側にまだ届く前に次の画面の認証チェックが
      // 走ってしまい、/loginに戻されることがある。
      // window.location.hrefでページ全体を読み込み直すことで、
      // 次のリクエストに確実に最新のCookieが乗るようにする。
      window.location.href = landing;
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F8] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#0F2537]">t-log</h1>
        <p className="mb-8 text-center text-sm text-slate-500">NLTC Junior Team</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#0F2537]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#0F2537]"
          />

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="h-12 rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:opacity-60"
          >
            {isPending ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          アカウントはスクール管理者からの招待メールで発行されます。
          初めての方は招待メール内のリンクからパスワードを設定してください。
        </p>
      </div>
    </main>
  );
}
