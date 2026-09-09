/**
 * seed-test-users.ts で作成したテストユーザー・関連データを削除する。
 * 使い方: npm run test:rls:cleanup
 */
import "dotenv/config";
import { adminClient } from "../migration/client";
import { TEST_EMAILS } from "./seed-test-users";

async function main() {
  const { data: users } = await adminClient.auth.admin.listUsers();
  const targets = (users?.users ?? []).filter((u) => Object.values(TEST_EMAILS).includes(u.email as any));

  for (const user of targets) {
    // app_users以下は players/coaches/parents/daily_logs/coach_notes/... すべて
    // ON DELETE CASCADE で連動削除されるため、auth.usersの削除のみでよい
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`❌ ${user.email} の削除に失敗: ${error.message}`);
    } else {
      console.log(`🗑️  ${user.email} を削除しました`);
    }
  }

  console.log(`✅ ${targets.length} 件のテストユーザーを削除しました`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
