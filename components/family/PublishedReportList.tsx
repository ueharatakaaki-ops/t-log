"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getSignedReportUrl } from "@/lib/reports/get-signed-report-url";
import type { PublishedReportRow } from "@/lib/queries/family-reports";

export function PublishedReportList({ reports }: { reports: PublishedReportRow[] }) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenPdf(reportId: string) {
    setError(null);
    setOpeningId(reportId);
    startTransition(async () => {
      const url = await getSignedReportUrl(reportId);
      if (!url) {
        setError("レポートを開けませんでした。時間をおいて再度お試しください");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

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
          <div className="flex gap-2">
            <Link
              href={`/reports/view/${r.id}`}
              className="h-12 flex-1 rounded-lg bg-[#0F2537] text-center text-base font-semibold leading-[3rem] text-white"
            >
              Webで見る
            </Link>
            <button
              type="button"
              onClick={() => handleOpenPdf(r.id)}
              disabled={isPending && openingId === r.id}
              className="h-12 flex-1 rounded-lg bg-slate-100 text-base font-semibold text-slate-700"
            >
              {isPending && openingId === r.id ? "開いています..." : "PDFを開く"}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
    </div>
  );
}
