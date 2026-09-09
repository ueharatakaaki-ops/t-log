import Link from "next/link";
import { requireStaff } from "@/lib/auth/require-staff";
import { getUpcomingSchedulesForSchool } from "@/lib/queries/coach-schedule";

export default async function CoachSchedulePage() {
  const staff = await requireStaff();
  const rows = await getUpcomingSchedulesForSchool(staff.schoolId);

  // 日付ごとにグループ化して表示する
  const byDate = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byDate.get(row.startDate) ?? [];
    list.push(row);
    byDate.set(row.startDate, list);
  }

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">出場予定の大会</h1>
      <p className="mb-6 text-sm text-slate-500">所属選手全体の登録済みスケジュール</p>

      {rows.length === 0 && <p className="text-sm text-slate-400">登録された予定はありません</p>}

      <div className="flex flex-col gap-4">
        {Array.from(byDate.entries()).map(([date, items]) => (
          <div key={date}>
            <p className="mb-2 text-xs font-semibold text-slate-400">{date}</p>
            <div className="flex flex-col gap-2">
              {items.map((s) => (
                <Link
                  key={s.id}
                  href={`/players/${s.playerId}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 active:bg-[#F4F6F8]"
                >
                  <div>
                    <p className="font-semibold text-[#0F2537]">{s.tournamentName}</p>
                    <p className="text-xs text-slate-500">
                      {s.playerName}
                      {s.venue && ` ／ ${s.venue}`}
                      {s.endDate && s.endDate !== s.startDate ? ` ／ 〜${s.endDate}` : ""}
                    </p>
                  </div>
                  <span className="text-slate-300">›</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
