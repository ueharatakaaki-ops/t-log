import { DailyLogForm } from "@/components/daily-log/DailyLogForm";
import { DateChips } from "@/components/daily-log/DateChips";
import { getTodaysDailyLog, getExistingDailyLogDates } from "./actions";
import { todayInJst, recentJstDates, isDailyLogEditable } from "@/lib/date";

export default async function DailyLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = todayInJst();
  // 直近1週間ぶんを候補にする。
  // 「記録済みの日」は修正期限（翌日9:00 JST）を過ぎたら選べなくする（後出しの書き換え防止）が、
  // 「まだ記録がない日」は書き忘れの救済のため、期限を過ぎていても選べるようにする。
  const candidateDates = recentJstDates(7);
  const existingDates = await getExistingDailyLogDates(candidateDates);
  const allowedDates = candidateDates.filter((d) => !existingDates.has(d) || isDailyLogEditable(d));
  const { date } = await searchParams;
  const logDate = date && allowedDates.includes(date) ? date : today;

  const existing = await getTodaysDailyLog(logDate);

  const initial = existing
    ? {
        sleepHours: existing.sleep_hours,
        fatigueLevel: existing.fatigue_level,
        hasPain: existing.has_pain,
        painLocations: existing.pain_locations ?? [],
        hasPractice: existing.has_practice,
        practiceIntensity: existing.practice_intensity,
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
      <DateChips dates={allowedDates} selected={logDate} today={today} enteredDates={existingDates} />
      <DailyLogForm key={logDate} logDate={logDate} isToday={logDate === today} initial={initial} />
    </main>
  );
}
