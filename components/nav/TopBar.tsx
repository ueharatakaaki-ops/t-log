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
const SIGN_OUT_TIMEOUT_MS = 10_000;

export function TopBar() {
  const [loggingOut, setLoggingOut] = useState(false);

  const [failed, setFailed] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    setFailed(false);
    const supabase = createClient();
    // scope: "local" … この端末のセッションだけを終了する。既定の "global" だと、同じアカウントで
    // ログインしている他の端末（選手のスマホなど）まで切れ、日次ログの送信が「ログイン切れ」になってしまう。
    // 通信が止まってもボタンが固まらないよう、一定時間で打ち切る。
    let error: unknown = null;
    try {
      ({ error } = await Promise.race([
        supabase.auth.signOut({ scope: "local" }),
        new Promise<{ error: Error }>((resolve) =>
          setTimeout(() => resolve({ error: new Error("signOut timeout") }), SIGN_OUT_TIMEOUT_MS)
        ),
      ]));
    } catch (e) {
      error = e;
    }
    if (error) {
      // 通信できずセッションが残っている。トップへ移動しても再びログイン中の画面になるため、案内して押し直してもらう
      setLoggingOut(false);
      setFailed(true);
      return;
    }
    // ミドルウェアやサーバーコンポーネント側のセッション判定も
    // 確実にリセットさせるため、クライアント側の遷移ではなく
    // 通常のページ遷移でトップページへ戻す。
    window.location.href = "/";
  }

  return (
    <div className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur print:hidden">
      {failed && (
        <span role="alert" className="text-xs text-rose-600">
          ログアウトできませんでした。通信を確認して、もう一度押してください
        </span>
      )}
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
