import Link from "next/link";
import { requireStaff } from "@/lib/auth/require-staff";
import { getPlayerList } from "@/lib/queries/player-list";
import { PlayerListTable } from "@/components/coach/PlayerListTable";
import type { SchoolGradeStage } from "@/lib/date";

const STAGES: { value: SchoolGradeStage; label: string }[] = [
  { value: "elementary", label: "小学生" },
  { value: "junior_high", label: "中学生" },
  { value: "high_school", label: "高校生" },
];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const staff = await requireStaff();
  const { stage } = await searchParams;
  const validStage = STAGES.find((s) => s.value === stage)?.value;
  const players = await getPlayerList(staff.schoolId, { stage: validStage });

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-4 text-xl font-bold text-[#0F2537]">選手一覧</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/players"
          className={`h-9 rounded-full px-3 text-sm font-semibold leading-9 ${
            !validStage ? "bg-[#0F2537] text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          すべて
        </Link>
        {STAGES.map((s) => (
          <Link
            key={s.value}
            href={`/players?stage=${s.value}`}
            className={`h-9 rounded-full px-3 text-sm font-semibold leading-9 ${
              validStage === s.value ? "bg-[#0F2537] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <PlayerListTable players={players} />
    </main>
  );
}
