import { requireStaff } from "@/lib/auth/require-staff";
import { getTodaysAlerts } from "@/lib/queries/coach-dashboard";
import { AlertList } from "@/components/coach/AlertList";

export default async function CoachDashboardPage() {
  const staff = await requireStaff();
  const { logDate, rows, submittedCount, totalActivePlayers } = await getTodaysAlerts(staff.schoolId);

  const redCount = rows.filter((r) => r.alertLevel === "red").length;
  const yellowCount = rows.filter((r) => r.alertLevel === "yellow").length;
  const unsubmittedCount = totalActivePlayers - submittedCount;

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">ダッシュボード</h1>
      <p className="mb-4 text-sm text-slate-500">{logDate} の状況</p>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <SummaryCard label="要注意" value={redCount} tone="rose" />
        <SummaryCard label="睡眠不足" value={yellowCount} tone="amber" />
        <SummaryCard label="未入力" value={unsubmittedCount} tone="slate" />
      </div>

      <p className="mb-2 text-sm font-semibold text-slate-700">
        入力率 {submittedCount}/{totalActivePlayers}
      </p>

      <AlertList rows={rows} />
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "rose" | "amber" | "slate";
}) {
  const toneClass = {
    rose: "text-rose-600",
    amber: "text-amber-600",
    slate: "text-slate-600",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 text-center">
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
