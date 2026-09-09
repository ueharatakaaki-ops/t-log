/**
 * Step 4: 移行結果の件数・集計値を出力する。
 * Looker Studio側の集計値と目視で突き合わせ、一致することを確認してから
 * 旧システム（Googleフォーム）をRead-only化する（Phase0レビュー STEP4参照）。
 *
 * 使い方: npm run migrate:verify
 */
import "dotenv/config";
import { adminClient, getNltcSchoolId } from "./client";

async function main() {
  const schoolId = await getNltcSchoolId();

  console.log("=== ステージング件数 ===");
  for (const table of ["staging_daily_logs", "staging_match_logs", "staging_goal_logs"] as const) {
    const { count } = await adminClient.from(table).select("*", { count: "exact", head: true }).eq("school_id", schoolId);
    console.log(`${table}: ${count ?? 0} 件`);
  }

  console.log("\n=== 本番投入件数（source='migrated'） ===");
  for (const table of ["daily_logs", "match_logs", "goal_logs"] as const) {
    const { count } = await adminClient
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("source", "migrated");
    console.log(`${table}: ${count ?? 0} 件`);
  }

  console.log("\n=== 退避された重複データ ===");
  const { count: dupCount } = await adminClient
    .from("migration_duplicates")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);
  console.log(`migration_duplicates: ${dupCount ?? 0} 件`);

  console.log("\n=== 選手別・月別の平均睡眠時間・平均疲労度（Looker Studioとの突合用） ===");
  const { data: players } = await adminClient.from("players").select("id, full_name").eq("school_id", schoolId);
  const { data: logs } = await adminClient
    .from("daily_logs")
    .select("player_id, log_date, sleep_hours, fatigue_level")
    .eq("school_id", schoolId)
    .eq("source", "migrated");

  const byPlayerMonth = new Map<string, { sleep: number[]; fatigue: number[] }>();
  for (const log of logs ?? []) {
    const month = log.log_date.slice(0, 7);
    const key = `${log.player_id}__${month}`;
    const bucket = byPlayerMonth.get(key) ?? { sleep: [], fatigue: [] };
    if (log.sleep_hours !== null) bucket.sleep.push(log.sleep_hours);
    if (log.fatigue_level !== null) bucket.fatigue.push(log.fatigue_level);
    byPlayerMonth.set(key, bucket);
  }

  const avg = (nums: number[]) => (nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "-");

  const nameById = new Map((players ?? []).map((p) => [p.id, p.full_name]));
  const rows = Array.from(byPlayerMonth.entries())
    .map(([key, bucket]) => {
      const [playerId, month] = key.split("__");
      return { name: nameById.get(playerId) ?? playerId, month, avgSleep: avg(bucket.sleep), avgFatigue: avg(bucket.fatigue), days: bucket.sleep.length };
    })
    .sort((a, b) => (a.name + a.month).localeCompare(b.name + b.month, "ja"));

  for (const r of rows) {
    console.log(`${r.name} / ${r.month}: 入力${r.days}日 平均睡眠${r.avgSleep}h 平均疲労${r.avgFatigue}`);
  }

  console.log(
    "\n上記の入力日数・平均値を、Looker Studioダッシュボードの同一選手・同一月の値と突き合わせてください。" +
      "一致すれば旧Googleフォームの並行運用期間（1〜2週間）に入り、差分がないことを確認したうえで完全移行としてください。"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
