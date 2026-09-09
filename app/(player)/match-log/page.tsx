import { createClient } from "@/lib/supabase/server";
import { MatchLogForm } from "@/components/match-log/MatchLogForm";
import type { ScheduleRow } from "@/components/schedule/ScheduleManager";
import { todayInJst } from "@/lib/date";

export default async function MatchLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = todayInJst();
  const { data } = user
    ? await supabase
        .from("tournament_schedules")
        .select("id, tournament_name, start_date, end_date, venue, surface")
        .eq("player_id", user.id)
        .gte("start_date", today)
        .order("start_date", { ascending: true })
    : { data: [] };

  const upcomingSchedules: ScheduleRow[] = (data ?? []).map((s) => ({
    id: s.id,
    tournamentName: s.tournament_name,
    startDate: s.start_date,
    endDate: s.end_date,
    venue: s.venue,
    surface: s.surface,
  }));

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">Match Log</h1>
      <p className="mb-6 text-sm text-slate-500">試合が終わったら振り返りを記録しよう</p>
      <MatchLogForm upcomingSchedules={upcomingSchedules} />
    </main>
  );
}
