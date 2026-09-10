import { createClient } from "@/lib/supabase/server";
import { todayInJst } from "@/lib/date";

export type CoachScheduleRow = {
  id: string;
  playerId: string;
  playerName: string;
  tournamentName: string;
  startDate: string;
  endDate: string | null;
  venue: string | null;
};

export async function getUpcomingSchedulesForSchool(schoolId: string): Promise<CoachScheduleRow[]> {
  const supabase = await createClient();
  // サーバーのタイムゾーン（UTC）ではなく、他の画面と同じくJST基準の「今日」で揃える
  const today = todayInJst();

  const { data } = await supabase
    .from("tournament_schedules")
    .select("id, player_id, tournament_name, start_date, end_date, venue, players(full_name)")
    .eq("school_id", schoolId)
    .gte("start_date", today)
    .order("start_date", { ascending: true });

  return (data ?? []).map((s) => {
    const player = Array.isArray(s.players) ? s.players[0] : s.players;
    return {
      id: s.id,
      playerId: s.player_id,
      playerName: player?.full_name ?? "-",
      tournamentName: s.tournament_name,
      startDate: s.start_date,
      endDate: s.end_date,
      venue: s.venue,
    };
  });
}
