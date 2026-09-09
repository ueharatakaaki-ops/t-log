import { createClient } from "@/lib/supabase/server";

export type MatchCardDetail = {
  id: string;
  playerId: string;
  playerName: string;
  matchDate: string;
  tournamentName: string;
  round: string | null;
  result: "win" | "lose" | null;
  score: string | null;
  surface: string | null;
  goodPoints: string | null;
  badNextPoints: string | null;
  coachComment: string | null;
};

const ROUND_LABEL: Record<string, string> = {
  qualifying: "予選",
  r1: "1回戦",
  r2: "2回戦",
  qf: "準々決勝",
  sf: "準決勝",
  f: "決勝",
  placement: "順位戦",
  practice: "練習試合",
};

export async function getMatchCardDetail(matchId: string): Promise<MatchCardDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("match_logs")
    .select(
      "id, player_id, match_date, tournament_name, round, result, score, surface, good_points, bad_next_points, coach_comment, players(full_name)"
    )
    .eq("id", matchId)
    .maybeSingle();

  if (!data) return null;

  const player = Array.isArray(data.players) ? data.players[0] : data.players;

  return {
    id: data.id,
    playerId: data.player_id,
    playerName: player?.full_name ?? "",
    matchDate: data.match_date,
    tournamentName: data.tournament_name,
    round: data.round ? ROUND_LABEL[data.round] ?? data.round : null,
    result: data.result,
    score: data.score,
    surface: data.surface,
    goodPoints: data.good_points,
    badNextPoints: data.bad_next_points,
    coachComment: data.coach_comment,
  };
}
