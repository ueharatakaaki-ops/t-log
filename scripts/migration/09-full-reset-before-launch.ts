/**
 * 本番ローンチ前に、既存のユーザーアカウント・移行データをすべて削除し、
 * まっさらな状態に戻す（うえはらさんの明示的な指示により、5〜8月に
 * Googleスプレッドシートから移行した実選手の過去記録も含めて削除する）。
 *
 * 削除対象:
 *   - すべてのauth.usersアカウント（役割問わず全員）
 *     → app_users/players/coaches/parents/daily_logs/match_logs/goal_logs/
 *       coach_notes/monthly_reports/tournament_schedules/
 *       parent_player_links/coach_player_links は ON DELETE CASCADE で連動削除される
 *   - audit_logs（app_usersを参照しており、先に消さないとFK制約で削除が失敗するため）
 *   - migration_name_map（playersを参照しており、先に消さないとFK制約で削除が失敗するため）
 *   - migration_duplicates, staging_daily_logs, staging_match_logs, staging_goal_logs
 *     （5〜8月の移行作業用の一時データ。もう不要なためあわせて削除する）
 *
 * 削除しないもの:
 *   - schools（NLTCという学校のレコード自体は残す。ここに新しいユーザーを招待していく）
 *   - contact_inquiries（お問い合わせフォームのデータ。ユーザーアカウントとは無関係のため対象外）
 *
 * 安全のためデフォルトはドライラン（件数の表示のみ、何も削除しない）。
 * 実際に削除するには --confirm を付けて実行すること。
 *
 * 使い方:
 *   npm run reset:full-before-launch                # 件数を確認するだけ
 *   npm run reset:full-before-launch -- --confirm   # 確認の上、実際にすべて削除する
 *
 * ⚠️ この操作は取り消せません。実行前に一覧をよく確認してください。
 * 実行後は、続けて "npm run bootstrap:system-admin" で最初のシステム管理者
 * アカウントを作り直す必要があります。
 */
import "dotenv/config";
import { adminClient } from "./client";

const ROLE_LABEL: Record<string, string> = {
  system_admin: "システム管理者",
  school_admin: "スクール管理者",
  coach: "コーチ",
  player: "選手",
  parent: "保護者",
};

// PostgRESTのdeleteは安全のためフィルタ必須なので、
// 「常に真になる条件」としてありえないUUIDへの not-equal を使う（既存スクリプトと同じ手法ではないが同種のイディオム）
const DELETE_ALL_FILTER_COLUMN = "id";
const IMPOSSIBLE_UUID = "00000000-0000-0000-0000-000000000000";

async function countRows(table: string): Promise<number> {
  const { count, error } = await adminClient.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table} の件数取得に失敗しました: ${error.message}`);
  return count ?? 0;
}

async function deleteAllRows(table: string) {
  const { error } = await adminClient.from(table).delete().neq(DELETE_ALL_FILTER_COLUMN, IMPOSSIBLE_UUID);
  if (error) throw new Error(`${table} の削除に失敗しました: ${error.message}`);
}

async function main() {
  const confirm = process.argv.includes("--confirm");

  const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw new Error(`ユーザー一覧の取得に失敗しました: ${usersError.message}`);
  const users = usersData?.users ?? [];

  const { data: appUsers } = await adminClient.from("app_users").select("id, display_name, role");
  const appUserMap = new Map((appUsers ?? []).map((u) => [u.id, u]));

  const [auditCount, nameMapCount, duplicatesCount, stagingDailyCount, stagingMatchCount, stagingGoalCount] =
    await Promise.all([
      countRows("audit_logs"),
      countRows("migration_name_map"),
      countRows("migration_duplicates"),
      countRows("staging_daily_logs"),
      countRows("staging_match_logs"),
      countRows("staging_goal_logs"),
    ]);

  console.log(`【削除対象アカウント】 ${users.length} 件`);
  for (const u of users) {
    const detail = appUserMap.get(u.id);
    const label = detail ? `${detail.display_name}（${ROLE_LABEL[detail.role] ?? detail.role}）` : "(app_usersに未登録)";
    console.log(`  - ${u.email ?? "(メールなし)"}  ${label}`);
  }

  console.log(`\n【あわせて削除される関連データの件数】`);
  console.log(`  - audit_logs（監査ログ）: ${auditCount} 件`);
  console.log(`  - migration_name_map（選手名の名寄せ結果）: ${nameMapCount} 件`);
  console.log(`  - migration_duplicates（移行時の重複退避データ）: ${duplicatesCount} 件`);
  console.log(
    `  - staging_daily_logs / staging_match_logs / staging_goal_logs（移行用一時データ）: ` +
      `${stagingDailyCount + stagingMatchCount + stagingGoalCount} 件`
  );
  console.log(
    `\n※ players/coaches/parents/daily_logs/match_logs/goal_logs/coach_notes/monthly_reports/` +
      `tournament_schedules等は、上記アカウントの削除に連動してすべて削除されます（5〜8月の実選手の記録を含む）。`
  );
  console.log(`※ schools（学校そのもの）と contact_inquiries（お問い合わせフォームのデータ）は削除しません。`);

  if (!confirm) {
    console.log(
      `\nこれはドライランです。内容を確認のうえ、実際に削除する場合は --confirm を付けて再実行してください。\n` +
        `  npm run reset:full-before-launch -- --confirm\n` +
        `\n⚠️ この操作は取り消せません。5〜8月に移行した実選手の過去記録も含めて、すべて消えます。`
    );
    return;
  }

  console.log(`\n--confirm が指定されたため、削除を実行します...\n`);

  // FK制約でブロックされるものを先に削除する
  await deleteAllRows("audit_logs");
  console.log(`  🗑️  audit_logs を削除しました`);
  await deleteAllRows("migration_name_map");
  console.log(`  🗑️  migration_name_map を削除しました`);
  await deleteAllRows("migration_duplicates");
  await deleteAllRows("staging_daily_logs");
  await deleteAllRows("staging_match_logs");
  await deleteAllRows("staging_goal_logs");
  console.log(`  🗑️  migration_duplicates / staging_* テーブルを削除しました`);

  let successCount = 0;
  for (const u of users) {
    const { error } = await adminClient.auth.admin.deleteUser(u.id);
    if (error) {
      console.error(`  ❌ ${u.email} の削除に失敗しました: ${error.message}`);
    } else {
      successCount++;
    }
  }

  console.log(`\n✅ ${successCount} / ${users.length} 件のアカウントを削除しました（関連データも連動削除済み）。`);
  console.log(`\n続けて "npm run bootstrap:system-admin" を実行し、最初のシステム管理者アカウントを作成してください。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
