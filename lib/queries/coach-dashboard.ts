import { createClient } from "@/lib/supabase/server";
import { todayInJst } from "@/lib/date";

export type AlertLevel = "red" | "yellow" | "none";

export type PlayerAlertRow = {
  playerId: string;
  fullName: string;
  category: string | null;
  hasSubmittedToday: boolean;
  alertLevel: AlertLevel;
  fatigueLevel: number | null;
  hasPain: boolean | null;
  painLocations: string[];
  sleepHours: number | null;
};

/**
 * 今日時点の要注意選手・未入力者を計算する。
 * RED: 疲労度8以上 or 痛みあり / YELLOW: 睡眠6時間未満 / 未入力: 当日ログなし
 * これは医学的診断ではなく、コーチが確認するための注意喚起である（Phase0レビュー STEP7準拠）。
 */
export async function getTodaysAlerts(schoolId: string): Promise<{
  logDate: string;
  rows: PlayerAlertRow[];
  submittedCount: number;
  totalActivePlayers: number;
}> {
  const supabase = await createClient();
  const logDate = todayInJst();

  const { data: players } = await supabase
    .from("players")
    .select("id, full_name, category")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("full_name");

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("player_id, fatigue_level, has_pain, pain_locations, sleep_hours")
    .eq("school_id", schoolId)
    .eq("log_date", logDate);

  const logByPlayer = new Map((logs ?? []).map((l) => [l.player_id, l]));

  const rows: PlayerAlertRow[] = (players ?? []).map((p) => {
    const log = logByPlayer.get(p.id);
    let alertLevel: AlertLevel = "none";
    if (log) {
      if ((log.fatigue_level ?? 0) >= 8 || log.has_pain) {
        alertLevel = "red";
      } else if ((log.sleep_hours ?? 99) < 6) {
        alertLevel = "yellow";
      }
    }
    return {
      playerId: p.id,
      fullName: p.full_name,
      category: p.category,
      hasSubmittedToday: !!log,
      alertLevel,
      fatigueLevel: log?.fatigue_level ?? null,
      hasPain: log?.has_pain ?? null,
      painLocations: log?.pain_locations ?? [],
      sleepHours: log?.sleep_hours ?? null,
    };
  });

  // 表示優先順: RED → YELLOW → 未入力 → 正常
  function rankOf(row: PlayerAlertRow): number {
    if (row.alertLevel === "red") return 0;
    if (row.alertLevel === "yellow") return 1;
    if (!row.hasSubmittedToday) return 2;
    return 3;
  }
  rows.sort((a, b) => {
    const diff = rankOf(a) - rankOf(b);
    if (diff !== 0) return diff;
    return a.fullName.localeCompare(b.fullName, "ja");
  });

  return {
    logDate,
    rows,
    submittedCount: rows.filter((r) => r.hasSubmittedToday).length,
    totalActivePlayers: rows.length,
  };
}
