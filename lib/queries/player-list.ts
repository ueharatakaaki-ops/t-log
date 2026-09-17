import { createClient } from "@/lib/supabase/server";
import { todayInJst, computeSchoolGrade, type SchoolGradeStage } from "@/lib/date";

export type PlayerListRow = {
  id: string;
  fullName: string;
  gradeLabel: string | null; // 生年月日から自動計算した学年（例: "小学6年"）
  gradeStage: SchoolGradeStage | null;
  status: "active" | "graduated" | "withdrawn";
  todayAlert: "red" | "yellow" | "none" | "unsubmitted";
};

export async function getPlayerList(
  schoolId: string,
  opts: { stage?: SchoolGradeStage; status?: string } = {}
): Promise<PlayerListRow[]> {
  const supabase = await createClient();
  const logDate = todayInJst();

  let query = supabase
    .from("players")
    .select("id, full_name, birthdate, status")
    .eq("school_id", schoolId)
    .order("full_name");

  if (opts.status) {
    query = query.eq("status", opts.status);
  } else {
    query = query.eq("status", "active"); // デフォルトは在籍中の選手のみ
  }

  const { data: playersRaw } = await query;

  // 学年は生年月日からの計算値のため、カテゴリーのようにDB側では絞り込めない。
  // 対象人数がスクール単位で少ないため、取得後にメモリ上でフィルタする。
  const players = opts.stage
    ? (playersRaw ?? []).filter((p) => computeSchoolGrade(p.birthdate)?.stage === opts.stage)
    : playersRaw ?? [];

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("player_id, fatigue_level, has_pain, sleep_hours")
    .eq("school_id", schoolId)
    .eq("log_date", logDate);

  const logByPlayer = new Map((logs ?? []).map((l) => [l.player_id, l]));

  return players.map((p) => {
    const log = logByPlayer.get(p.id);
    let todayAlert: PlayerListRow["todayAlert"] = "unsubmitted";
    if (log) {
      if ((log.fatigue_level ?? 0) >= 8 || log.has_pain) todayAlert = "red";
      else if ((log.sleep_hours ?? 99) < 6) todayAlert = "yellow";
      else todayAlert = "none";
    }
    const grade = computeSchoolGrade(p.birthdate);
    return {
      id: p.id,
      fullName: p.full_name,
      gradeLabel: grade?.label ?? null,
      gradeStage: grade?.stage ?? null,
      status: p.status,
      todayAlert,
    };
  });
}
