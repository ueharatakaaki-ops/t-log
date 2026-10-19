// E2Eテスト用: デモスクール（slug: demo）の「デモ 花子」の Daily Log だけを読み書きする。
// 他のスクール・他の選手のデータには触れない（必ず school_id と player_id の両方で絞る）。
import "../../scripts/demo/env";
import { adminClient, assertDemoSchool, DEMO_ACCOUNTS, findDemoSchool } from "../../scripts/demo/common";

export async function demoPlayer(key: "hanako" | "taro" = "hanako") {
  const school = await findDemoSchool();
  if (!school) throw new Error("デモスクールがありません（npm run demo:seed -- --yes で作成）");
  assertDemoSchool(school);
  const { data, error } = await adminClient
    .from("app_users")
    .select("id")
    .eq("school_id", school.id)
    .eq("role", "player")
    .eq("display_name", DEMO_ACCOUNTS[key].displayName)
    .single();
  if (error || !data) throw new Error(`デモ選手(${key})が見つかりません`);
  return { schoolId: school.id as string, playerId: data.id as string };
}

export async function countDailyLogs(p: { schoolId: string; playerId: string }, logDate: string) {
  const { count, error } = await adminClient
    .from("daily_logs")
    .select("id", { count: "exact", head: true })
    .eq("school_id", p.schoolId)
    .eq("player_id", p.playerId)
    .eq("log_date", logDate);
  if (error) throw new Error(`daily_logs の件数取得に失敗: ${error.message}`);
  return count ?? 0;
}

export async function deleteDailyLog(p: { schoolId: string; playerId: string }, logDate: string) {
  const { error } = await adminClient
    .from("daily_logs")
    .delete()
    .eq("school_id", p.schoolId)
    .eq("player_id", p.playerId)
    .eq("log_date", logDate);
  if (error) throw new Error(`daily_logs の削除に失敗: ${error.message}`);
}
