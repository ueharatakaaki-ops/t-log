import Link from "next/link";
import { requireStaff } from "@/lib/auth/require-staff";
import { getReportListForMonth } from "@/lib/queries/reports-list";
import { ReportListTable } from "@/components/reports/ReportListTable";
import { defaultReportTargetMonth } from "@/lib/date";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const staff = await requireStaff();
  const { month } = await searchParams;
  const targetMonth = month ? `${month}-01` : defaultReportTargetMonth();
  const rows = await getReportListForMonth(staff.schoolId, targetMonth);

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">月次レポート管理</h1>
      <p className="mb-4 text-sm text-slate-500">対象月: {targetMonth.slice(0, 7)}</p>

      <div className="mb-4">
        <MonthPicker currentValue={targetMonth.slice(0, 7)} />
      </div>

      <ReportListTable rows={rows} targetMonth={targetMonth} />
    </main>
  );
}

function MonthPicker({ currentValue }: { currentValue: string }) {
  // シンプルなGETナビゲーションで前後の月に移動する
  const [y, m] = currentValue.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2">
      <Link href={`/reports/manage?month=${prev}`} className="h-9 rounded-lg bg-slate-100 px-3 text-sm font-semibold leading-9 text-slate-700">
        ← 前月
      </Link>
      <Link href={`/reports/manage?month=${next}`} className="h-9 rounded-lg bg-slate-100 px-3 text-sm font-semibold leading-9 text-slate-700">
        次月 →
      </Link>
    </div>
  );
}
