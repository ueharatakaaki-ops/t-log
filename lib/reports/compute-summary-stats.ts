import { createAdminClient } from "@/lib/supabase/server";

export type MonthlyReportSummaryStats = {
  loggedDays: number;           // Daily Log 入力日数
  matchCount: number;           // 試合報告数
  avgSleepHours: number | null; // 平均睡眠時間
  avgFatigueLevel: number | null; // 平均疲労度
  avgSelfScore: number | null;
  painDays: { date: string; locations: string[] }[]; // 痛み履歴
  dailySeries: { date: string; sleepHours: number | null; fatigueLevel: number | null }[]; // グラフ用
  goodBadTrend: { good: string[]; bad: string[] }; // Match Logからの良かった点/課題の抜粋
};

/**
 * 任意の期間 [startDate, endDateExclusive) を対象に、daily_logs / match_logs から
 * 集計値を計算する汎用関数。月次レポート・カスタム期間レポート双方から使う。
 * RLSを経由しない管理用クライアントを使用（コーチの操作起点でサーバー側のみ実行される想定）。
 */
export async function computeStatsForRange(
  playerId: string,
  startDate: string,
  endDateExclusive: string
): Promise<MonthlyReportSummaryStats> {
  const supabase = createAdminClient();

  const { data: dailyLogs } = await supabase
    .from("daily_logs")
    .select("log_date, sleep_hours, fatigue_level, self_score, has_pain, pain_locations")
    .eq("player_id", playerId)
    .gte("log_date", startDate)
    .lt("log_date", endDateExclusive)
    .order("log_date", { ascending: true });

  const { data: matchLogs } = await supabase
    .from("match_logs")
    .select("good_points, bad_next_points")
    .eq("player_id", playerId)
    .gte("match_date", startDate)
    .lt("match_date", endDateExclusive);

  const logs = dailyLogs ?? [];
  const matches = matchLogs ?? [];

  const avg = (nums: number[]) =>
    nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

  const sleepValues = logs.map((l) => l.sleep_hours).filter((v): v is number => v !== null);
  const fatigueValues = logs.map((l) => l.fatigue_level).filter((v): v is number => v !== null);
  const selfScoreValues = logs.map((l) => l.self_score).filter((v): v is number => v !== null);

  const painDays = logs
    .filter((l) => l.has_pain)
    .map((l) => ({ date: l.log_date, locations: l.pain_locations ?? [] }));

  return {
    loggedDays: logs.length,
    matchCount: matches.length,
    avgSleepHours: avg(sleepValues),
    avgFatigueLevel: avg(fatigueValues),
    avgSelfScore: avg(selfScoreValues),
    painDays,
    dailySeries: logs.map((l) => ({
      date: l.log_date,
      sleepHours: l.sleep_hours,
      fatigueLevel: l.fatigue_level,
    })),
    goodBadTrend: {
      good: matches.map((m) => m.good_points).filter((v): v is string => !!v),
      bad: matches.map((m) => m.bad_next_points).filter((v): v is string => !!v),
    },
  };
}

/** targetMonth ("YYYY-MM-01") を対象月とする月次レポート用のラッパー */
export async function computeMonthlySummaryStats(
  playerId: string,
  targetMonth: string
): Promise<MonthlyReportSummaryStats> {
  const [y, m] = targetMonth.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return computeStatsForRange(playerId, targetMonth, nextMonth);
}
