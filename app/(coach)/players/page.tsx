import Link from "next/link";
import { requireStaff } from "@/lib/auth/require-staff";
import { getPlayerList } from "@/lib/queries/player-list";
import { PlayerListTable } from "@/components/coach/PlayerListTable";

const CATEGORIES = ["U12", "U14", "U15", "U18"];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const staff = await requireStaff();
  const { category } = await searchParams;
  const players = await getPlayerList(staff.schoolId, { category });

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-4 text-xl font-bold text-[#0F2537]">選手一覧</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/players"
          className={`h-9 rounded-full px-3 text-sm font-semibold leading-9 ${
            !category ? "bg-[#0F2537] text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          すべて
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/players?category=${c}`}
            className={`h-9 rounded-full px-3 text-sm font-semibold leading-9 ${
              category === c ? "bg-[#0F2537] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      <PlayerListTable players={players} />
    </main>
  );
}
