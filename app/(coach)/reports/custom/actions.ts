"use server";

import { requireStaff } from "@/lib/auth/require-staff";
import { createClient } from "@/lib/supabase/server";
import { computeStatsForRange, type MonthlyReportSummaryStats } from "@/lib/reports/compute-summary-stats";
import type { MatchSummary } from "@/lib/queries/player-detail";

export type CustomReportResult =
  | {
      ok: true;
      playerName: string;
      stats: MonthlyReportSummaryStats;
      matches: MatchSummary[];
    }
  | { ok: false; error: string };

export async function computeCustomReport(
  playerId: string,
  startDate: string,
  endDate: string
): Promise<CustomReportResult> {
  await requireStaff();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: "日付の形式が不正です" };
  }
  if (startDate > endDate) {
    return { ok: false, error: "開始日は終了日より前にしてください" };
  }

  const supabase = await createClient();
  const { data: player } = await supabase.from("players").select("full_name").eq("id", playerId).maybeSingle();
  if (!player) return { ok: false, error: "選手が見つかりません" };

  // endDateを含むように1日進めた排他的境界を渡す
  const endExclusive = new Date(endDate + "T00:00:00Z");
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const endExclusiveStr = endExclusive.toISOString().slice(0, 10);

  const stats = await computeStatsForRange(playerId, startDate, endExclusiveStr);

  const { data: matchLogs } = await supabase
    .from("match_logs")
    .select("id, match_date, tournament_name, round, result, score, good_points, bad_next_points")
    .eq("player_id", playerId)
    .gte("match_date", startDate)
    .lt("match_date", endExclusiveStr)
    .order("match_date", { ascending: false });

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

  return { ok: true, playerName: player.full_name, stats, matches };
}
