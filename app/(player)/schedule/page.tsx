import { createClient } from "@/lib/supabase/server";
import { ScheduleManager, type ScheduleRow } from "@/components/schedule/ScheduleManager";
import { todayInJst } from "@/lib/date";

export default async function SchedulePage() {
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

  const schedules: ScheduleRow[] = (data ?? []).map((s) => ({
    id: s.id,
    tournamentName: s.tournament_name,
    startDate: s.start_date,
    endDate: s.end_date,
    venue: s.venue,
    surface: s.surface,
  }));

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">大会スケジュール</h1>
      <p className="mb-6 text-sm text-slate-500">出場予定の大会を事前に登録しておこう</p>
      <ScheduleManager schedules={schedules} />
    </main>
  );
}
