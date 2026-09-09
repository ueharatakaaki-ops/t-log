"use client";

import Link from "next/link";
import { useTransition } from "react";
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

  function handleGenerate(playerId: string) {
    startTransition(async () => {
      await generateDraftReport(playerId, targetMonth);
      // 生成後はサーバー側でrevalidateされるため、ページ再取得で状態が更新される
    });
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
      {rows.map((row) => {
        const status = STATUS_LABEL[row.status];
        return (
          <div key={row.playerId} className="flex items-center justify-between p-4">
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
        );
      })}
    </div>
  );
}
