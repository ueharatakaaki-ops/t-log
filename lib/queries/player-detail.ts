import { createClient } from "@/lib/supabase/server";

export type PlayerProfile = {
  id: string;
  fullName: string;
  birthdate: string | null;
  grade: string | null;
  category: string | null;
  status: string;
};

export type DailyTrendPoint = {
  id: string;
  logDate: string;
  sleepHours: number | null;
  fatigueLevel: number | null;
  selfScore: number | null;
  hasPain: boolean;
  painLocations: string[];
  notes: string | null;
  likedByCoach: boolean;
};

export type MatchSummary = {
  id: string;
  matchDate: string;
  tournamentName: string;
  round: string | null;
  result: "win" | "lose" | null;
  score: string | null;
  goodPoints: string | null;
  badNextPoints: string | null;
};

export type CoachNoteRow = {
  id: string;
  content: string;
  visibility: "internal" | "shared_with_family";
  createdAt: string;
  coachId: string;
};

export type GoalSummary = {
  targetMonth: string;
  technicalGoal: string | null;
  physicalGoal: string | null;
  actionPlan: string | null;
  coachFeedback: string | null;
};

export async function getPlayerDetail(playerId: string) {
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, birthdate, grade, category, status")
    .eq("id", playerId)
    .maybeSingle();

  if (!player) return null;

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: dailyLogs } = await supabase
    .from("daily_logs")
    .select("id, log_date, sleep_hours, fatigue_level, self_score, has_pain, pain_locations, notes, liked_by_coach_at")
    .eq("player_id", playerId)
    .gte("log_date", sinceStr)
    .order("log_date", { ascending: true });

  // 選手・保護者が「過去の試合を振り返る」用途で使うため、件数の上限は設けず全件を新しい順で返す
  const { data: matchLogs } = await supabase
    .from("match_logs")
    .select("id, match_date, tournament_name, round, result, score, good_points, bad_next_points")
    .eq("player_id", playerId)
    .order("match_date", { ascending: false });

  const { data: goalLog } = await supabase
    .from("goal_logs")
    .select("target_month, technical_goal, physical_goal, action_plan, coach_feedback")
    .eq("player_id", playerId)
    .order("target_month", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: notes } = await supabase
    .from("coach_notes")
    .select("id, content, visibility, created_at, coach_id")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  const profile: PlayerProfile = {
    id: player.id,
    fullName: player.full_name,
    birthdate: player.birthdate,
    grade: player.grade,
    category: player.category,
    status: player.status,
  };

  const dailyTrend: DailyTrendPoint[] = (dailyLogs ?? []).map((l) => ({
    id: l.id,
    logDate: l.log_date,
    sleepHours: l.sleep_hours,
    fatigueLevel: l.fatigue_level,
    selfScore: l.self_score,
    hasPain: l.has_pain,
    painLocations: l.pain_locations ?? [],
    notes: l.notes,
    likedByCoach: !!l.liked_by_coach_at,
  }));

  const matches: MatchSummary[] = (matchLogs ?? []).map((m) => ({
    id: m.id,
    matchDate: m.match_date,
    tournamentName: m.tournament_name,
    round: m.round,
    result: m.result,
    score: m.score,
    goodPoints: m.good_points,
    badNextPoints: m.bad_next_points,
  }));

  const goal: GoalSummary | null = goalLog
    ? {
        targetMonth: goalLog.target_month,
        technicalGoal: goalLog.technical_goal,
        physicalGoal: goalLog.physical_goal,
        actionPlan: goalLog.action_plan,
        coachFeedback: goalLog.coach_feedback,
      }
    : null;

  const coachNotes: CoachNoteRow[] = (notes ?? []).map((n) => ({
    id: n.id,
    content: n.content,
    visibility: n.visibility,
    createdAt: n.created_at,
    coachId: n.coach_id,
  }));

  return { profile, dailyTrend, matches, goal, coachNotes };
}
