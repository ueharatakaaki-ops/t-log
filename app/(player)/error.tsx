"use client";

// 選手画面でサーバー/クライアントの例外が起きた際の表示。
// これが無いとNext.js標準の「Application error」の白い画面になり、
// 選手からは「サイトに繋がらない」ように見えてしまう。
export default function PlayerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    </main>
  );
}
