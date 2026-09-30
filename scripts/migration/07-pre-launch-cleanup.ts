/**
 * 本番ローンチ前に、開発・テスト用に作成したダミーアカウントを一括削除する。
 *
 * 対象（このいずれかに一致するauth.usersアカウントを削除する）:
 *   1. email が "@t-log-demo.invalid" で終わるもの
 *      → 05-seed-demo-roster.ts で作成した、ホームページスクリーンショット用のデモ選手
 *   2. user_metadata.demo_seed === true のもの（上記の別の判定条件、念のため二重チェック）
 *   3. scripts/security/seed-test-users.ts の TEST_EMAILS に含まれるメールアドレス
 *      → RLS（行レベルセキュリティ）の検証用テストアカウント
 *
 * 実選手・実コーチ・実保護者のアカウント（招待済みのものも含む）や、
 * Googleスプレッドシートから移行した実データ（daily_logs等）には一切触れない。
 *
 * 安全のためデフォルトは「対象一覧の表示のみ」（ドライラン）。
 * 実際に削除するには --confirm を付けて実行すること。
 *
 * 使い方:
 *   npm run cleanup:pre-launch                # 対象を確認するだけ（何も削除しない）
 *   npm run cleanup:pre-launch -- --confirm   # 確認の上、実際に削除する
 *
 * 削除の仕組み:
 *   app_users.id は auth.users(id) を参照して on delete cascade になっており、
 *   players/coaches/parents/daily_logs/match_logs/goal_logs/coach_notes/
 *   monthly_reports/tournament_schedules/parent_player_links/coach_player_links も
 *   すべて players/coaches/parents からの on delete cascade で連動削除される。
 *   そのため auth.users 側を削除するだけでよい（cleanup-test-users.tsと同じ考え方）。
 */
import "dotenv/config";
import { adminClient } from "./client";

const DEMO_EMAIL_SUFFIX = "@t-log-demo.invalid";

// scripts/security/seed-test-users.ts の TEST_EMAILS をここに複製している。
// 理由: あのファイルは末尾で main().catch(...) を無条件に実行しているため、
// import { TEST_EMAILS } from "../security/seed-test-users" のようにimportすると、
// 定数を読みたいだけなのにRLSテストデータの再作成が副作用として走ってしまう
// （実際、既存の cleanup-test-users.ts も同じ問題を抱えている）。
// このスクリプトは削除専用にしたいため、あえて値だけを複製して安全側に倒す。
const TEST_EMAIL_SET = new Set<string>([
  "rls-test-player-a@example.com",
  "rls-test-player-b@example.com",
  "rls-test-parent-a@example.com",
  "rls-test-parent-b@example.com",
  "rls-test-coach-a@example.com",
]);

function isTargetUser(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }): {
  isTarget: boolean;
  reason: string | null;
} {
  const email = user.email ?? "";
  if (email.endsWith(DEMO_EMAIL_SUFFIX)) {
    return { isTarget: true, reason: "デモ選手（05-seed-demo-roster.ts）" };
  }
  if (user.user_metadata?.demo_seed === true) {
    return { isTarget: true, reason: "デモ選手（user_metadata.demo_seed）" };
  }
  if (TEST_EMAIL_SET.has(email)) {
    return { isTarget: true, reason: "RLS検証用テストアカウント（seed-test-users.ts）" };
  }
  return { isTarget: false, reason: null };
}

async function main() {
  const confirm = process.argv.includes("--confirm");

  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`ユーザー一覧の取得に失敗しました: ${error.message}`);

  const targets = (data?.users ?? [])
    .map((u) => ({ user: u, ...isTargetUser(u) }))
    .filter((r) => r.isTarget);

  if (targets.length === 0) {
    console.log("削除対象のデモ・テストアカウントは見つかりませんでした。");
    return;
  }

  // app_usersの表示名も合わせて確認できるようにする（emailだけだと本人確認しづらいため）
  const ids = targets.map((t) => t.user.id);
  const { data: appUsers } = await adminClient
    .from("app_users")
    .select("id, display_name, role")
    .in("id", ids);
  const nameMap = new Map((appUsers ?? []).map((u) => [u.id, `${u.display_name}（${u.role}）`]));

  console.log(`【対象一覧】 ${targets.length} 件\n`);
  for (const t of targets) {
    const label = nameMap.get(t.user.id) ?? "(app_usersに未登録)";
    console.log(`  - ${t.user.email}  ${label}  … ${t.reason}`);
  }

  if (!confirm) {
    console.log(
      "\nこれはドライランです。上記の内容を確認のうえ、実際に削除する場合は --confirm を付けて再実行してください。\n" +
        "  npm run cleanup:pre-launch -- --confirm"
    );
    return;
  }

  console.log("\n--confirm が指定されたため、削除を実行します...\n");
  let successCount = 0;
  for (const t of targets) {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(t.user.id);
    if (deleteError) {
      console.error(`  ❌ ${t.user.email} の削除に失敗しました: ${deleteError.message}`);
    } else {
      console.log(`  🗑️  ${t.user.email} を削除しました`);
      successCount++;
    }
  }

  console.log(`\n✅ ${successCount} / ${targets.length} 件を削除しました。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
