"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LANDING } from "@/lib/auth/role-landing";

/**
 * トップページ。
 *
 * Supabaseの招待・パスワードリセットメールのリンクは、設定によって
 * 2つの形式のどちらかでこのページに着地する:
 *   (a) URLの#以降（フラグメント）に access_token 等を含む形式
 *   (b) ?code=... というcrypto的な使い捨てコードを含む形式（PKCE）
 * (a)はサーバーに送られないためクライアント側でSupabaseが自動検出する。
 * (b)はクエリパラメータなのでサーバーにも送られるが、ここでは統一的に
 * クライアント側で exchangeCodeForSession() を呼んで処理する。
 *
 * どちらの形式で来るかは事前に断定できないため、両方に対応している。
 * このページ自体はmiddleware.tsのPUBLIC_PATHSに含め、未ログイン状態でも
 * 一度はここに到達できるようにしてある。
 */
export default function RootPage() {
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hash = window.location.hash;

      if (code) {
        // (b) ?code=... 形式。招待・パスワードリセット共通で使われる使い捨てコード。
        await supabase.auth.exchangeCodeForSession(code);
      } else if (hash.includes("access_token=")) {
        // (a) #access_token=... 形式。
        // @supabase/ssr の createBrowserClient は Cookie経由のPKCEフロー向けに
        // 最適化されており、この「#以降にトークンが直接書かれた」形式を
        // 自動では検出してくれない。そのためここで手動にパースし、
        // setSession() で明示的にセッションを確立する。
        const hashParams = new URLSearchParams(hash.slice(1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const isInviteOrRecovery =
        hash.includes("type=invite") || hash.includes("type=recovery") || !!code;

      if (isInviteOrRecovery) {
        window.location.href = "/auth/set-password";
        return;
      }

      const { data: appUser } = await supabase
        .from("app_users")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const landing = appUser?.role ? ROLE_LANDING[appUser.role] ?? "/login" : "/login";
      window.location.href = landing;
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
      <p className="text-sm text-slate-400">読み込み中...</p>
    </main>
  );
}
