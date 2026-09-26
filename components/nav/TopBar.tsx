"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ログイン中の全画面（コーチ・選手・保護者・管理者）共通の、
 * ごく簡易なヘッダー。今のところ「ログアウト」だけを置いている。
 * 下部タブ（BottomNav）に混ぜず別コンポーネントにしているのは、
 * 選手用ナビゲーションだけでタブ数がすでに多く、これ以上増やすと
 * スマホ幅で窮屈になるため。
 */
export function TopBar() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // ミドルウェアやサーバーコンポーネント側のセッション判定も
    // 確実にリセットさせるため、クライアント側の遷移ではなく
    // 通常のページ遷移でトップページへ戻す。
    window.location.href = "/";
  }

  return (
    <div className="flex items-center justify-end border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur print:hidden">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50"
      >
        {loggingOut ? "ログアウト中..." : "ログアウト"}
      </button>
    </div>
  );
}
