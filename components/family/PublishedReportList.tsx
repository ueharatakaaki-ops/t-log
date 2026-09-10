"use client";

import Link from "next/link";
import type { PublishedReportRow } from "@/lib/queries/family-reports";

export function PublishedReportList({ reports }: { reports: PublishedReportRow[] }) {
  if (reports.length === 0) {
    return <p className="text-sm text-slate-400">まだ発行されたレポートはありません</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {reports.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="font-semibold text-[#0F2537]">{r.targetMonth.slice(0, 7)} 月次レポート</p>
          {r.publishedAt && (
            <p className="mb-3 text-xs text-slate-400">
              発行日: {new Date(r.publishedAt).toLocaleDateString("ja-JP")}
            </p>
          )}
          <Link
            href={`/reports/view/${r.id}`}
            className="block h-12 rounded-lg bg-[#0F2537] text-center text-base font-semibold leading-[3rem] text-white"
          >
            Webで見る
          </Link>
        </div>
      ))}
    </div>
  );
}
