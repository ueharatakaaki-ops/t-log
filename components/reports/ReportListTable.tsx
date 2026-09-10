"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { generateDraftReport } from "@/app/(coach)/reports/manage/actions";
import type { ReportListRow } from "@/lib/queries/reports-list";

const STATUS_LABEL: Record<ReportListRow["status"], { text: string; className: string }> = {
  none: { text: "未生成", className: "bg-slate-100 text-slate-500" },
  draft: { text: "下書き", className: "bg-amber-100 text-amber-700" },
  reviewed: { text: "確認済み", className: "bg-sky-100 text-sky-700" },
  published: { text: "公開済み", className: "bg-emerald-100 text-emerald-700" },
};

export function ReportListTable({
  rows,
  targetMonth,
}: {
  rows: ReportListRow[];
  targetMonth: string;
}) {
  const [isPending, startTransition] = useTransition();
  // 選手ごとの生成結果メッセージ（特にAI文章生成の失敗理由）を出し分けるための状態。
  // 以前はここで結果を確認する手段が無く、技術評価欄が空のまま気づけないという
  // 不具合報告につながっていた。
  const [messages, setMessages] = useState<Record<string, string>>({});

  function handleGenerate(playerId: string) {
    setMessages((prev) => ({ ...prev, [playerId]: "" }));
    startTransition(async () => {
      const res = await generateDraftReport(playerId, targetMonth);
      if (!res.ok) {
        setMessages((prev) => ({ ...prev, [playerId]: res.error }));
        return;
      }
      if (res.narrative.status === "failed") {
        setMessages((prev) => ({
          ...prev,
          [playerId]: `下書きは作成できましたが、AI文章（技術・メンタル評価）の自動生成に失敗しました: ${res.narrative.error}／編集画面から手入力するか、原因を解消のうえ再生成してください`,
        }));
      }
      // 生成後はサーバー側でrevalidateされるため、ページ再取得で状態が更新される
    });
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
      {rows.map((row) => {
        const status = STATUS_LABEL[row.status];
        const message = messages[row.playerId];
        return (
          <div key={row.playerId} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#0F2537]">{row.fullName}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                  {status.text}
                </span>
              </div>
              {row.reportId ? (
                <Link
                  href={`/reports/manage/${row.reportId}`}
                  className="h-9 rounded-lg bg-[#0F2537] px-3 text-sm font-semibold leading-9 text-white"
                >
                  {row.status === "published" ? "確認する" : "編集する"}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleGenerate(row.playerId)}
                  className="h-9 rounded-lg bg-[#0F2537] px-3 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  下書き生成
                </button>
              )}
            </div>
            {message && <p className="text-xs font-medium text-amber-700">{message}</p>}
          </div>
        );
      })}
    </div>
  );
}
