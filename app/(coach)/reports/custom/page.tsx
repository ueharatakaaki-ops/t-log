import { requireStaff } from "@/lib/auth/require-staff";
import { getPlayerList } from "@/lib/queries/player-list";
import { CustomReportForm } from "@/components/reports/CustomReportForm";

export default async function CustomReportPage() {
  const staff = await requireStaff();
  const players = await getPlayerList(staff.schoolId);

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">期間指定レポート</h1>
      <p className="mb-6 text-sm text-slate-500">
        任意の期間を指定して、コンディション・試合結果を集計できます（月次レポートとは別に、随時確認する用途）
      </p>
      <CustomReportForm players={players.map((p) => ({ id: p.id, fullName: p.fullName }))} />
    </main>
  );
}
