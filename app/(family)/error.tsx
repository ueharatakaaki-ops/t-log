"use client";

import { useEffect, useState } from "react";

// 保護者画面（選手本人が使う履歴・レポート画面を含む）でサーバー/クライアントの
// 例外が起きた際の表示。これが無いとNext.js標準の「Application error」の
// 白い画面になり、利用者からは「サイトに繋がらない」ように見えてしまう。
export default function FamilyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // 発生時刻は初回描画時に固定する（SSRとクライアントで値がずれうるため suppressHydrationWarning を付ける）
  const [occurredAt] = useState(() => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }));

  useEffect(() => {
    console.error(error);
  }, [error]);

  // 選手が画面を撮影して送れるよう、原因調査に必要な情報だけを小さく表示する。
  // 本番のサーバー例外は message が伏せられ digest のみになるため、digest は必ず出す。
  // トークン等が含まれうるURLのクエリ文字列は表示しない。
  const message = (error.message ?? "").replace(/\?\S*/g, "").slice(0, 100);
  const detail = [error.digest ? `エラー番号: ${error.digest}` : null, occurredAt, message || null]
    .filter(Boolean)
    .join(" / ");

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-10 text-center">
      <p className="font-bold text-[#0F2537]">読み込みに失敗しました</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-[#0F2537] px-4 py-2 text-white"
      >
        再読み込み
      </button>
      <p className="mx-auto mt-4 max-w-md break-all text-xs text-slate-400" suppressHydrationWarning>
        {detail}
      </p>
    </main>
  );
}
