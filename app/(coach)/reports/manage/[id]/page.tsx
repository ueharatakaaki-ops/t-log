import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/require-staff";
import { getMonthlyReport } from "@/lib/queries/monthly-report-detail";
import { ReportEditor } from "@/components/reports/ReportEditor";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const report = await getMonthlyReport(id);

  if (!report) notFound();

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">{report.playerName}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {report.targetMonth.slice(0, 7)} の月次レポート ／ ステータス: {statusLabel(report.status)}
      </p>
      <ReportEditor report={report} />
    </main>
  );
}

function statusLabel(status: string) {
  return { draft: "下書き", reviewed: "確認済み", published: "公開済み" }[status] ?? status;
}
