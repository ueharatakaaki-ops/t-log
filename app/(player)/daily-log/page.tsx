import { DailyLogForm } from "@/components/daily-log/DailyLogForm";
import { DateChips } from "@/components/daily-log/DateChips";
import { getTodaysDailyLog } from "./actions";
import { todayInJst, recentJstDates } from "@/lib/date";

export default async function DailyLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = todayInJst();
  const allowedDates = recentJstDates(3); // [今日, 昨日, 一昨日]
  const { date } = await searchParams;
  const logDate = date && allowedDates.includes(date) ? date : today;

  const existing = await getTodaysDailyLog(logDate);

  const initial = existing
    ? {
        sleepHours: existing.sleep_hours,
        fatigueLevel: existing.fatigue_level,
        hasPain: existing.has_pain,
        painLocations: existing.pain_locations ?? [],
        selfScore: existing.self_score,
        notes: existing.notes ?? "",
      }
    : null;

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">Daily Log</h1>
      <p className="mb-4 text-sm text-slate-500">
        対象日を選んで記録しよう{existing && "（入力済み・修正できます）"}
      </p>
      <DateChips dates={allowedDates} selected={logDate} today={today} />
      <DailyLogForm key={logDate} logDate={logDate} initial={initial} />
    </main>
  );
}
