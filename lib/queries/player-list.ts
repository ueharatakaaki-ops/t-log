import { createClient } from "@/lib/supabase/server";
import { todayInJst } from "@/lib/date";

export type PlayerListRow = {
  id: string;
  fullName: string;
  category: string | null;
  grade: string | null;
  status: "active" | "graduated" | "withdrawn";
  todayAlert: "red" | "yellow" | "none" | "unsubmitted";
};

export async function getPlayerList(
  schoolId: string,
  opts: { category?: string; status?: string } = {}
): Promise<PlayerListRow[]> {
  const supabase = await createClient();
  const logDate = todayInJst();

  let query = supabase
    .from("players")
    .select("id, full_name, category, grade, status")
    .eq("school_id", schoolId)
    .order("full_name");

  if (opts.status) {
    query = query.eq("status", opts.status);
  } else {
    query = query.eq("status", "active"); // デフォルトは在籍中の選手のみ
  }
  if (opts.category) {
    query = query.eq("category", opts.category);
  }

  const { data: players } = await query;

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("player_id, fatigue_level, has_pain, sleep_hours")
    .eq("school_id", schoolId)
    .eq("log_date", logDate);

  const logByPlayer = new Map((logs ?? []).map((l) => [l.player_id, l]));

  return (players ?? []).map((p) => {
    const log = logByPlayer.get(p.id);
    let todayAlert: PlayerListRow["todayAlert"] = "unsubmitted";
    if (log) {
      if ((log.fatigue_level ?? 0) >= 8 || log.has_pain) todayAlert = "red";
      else if ((log.sleep_hours ?? 99) < 6) todayAlert = "yellow";
      else todayAlert = "none";
    }
    return {
      id: p.id,
      fullName: p.full_name,
      category: p.category,
      grade: p.grade,
      status: p.status,
      todayAlert,
    };
  });
}
