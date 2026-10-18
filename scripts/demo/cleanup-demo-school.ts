/**
 * seed-demo-school.ts で作成したデモスクール（slug: demo）と、そこに属するユーザー・データだけを削除する。
 * すべての削除はデモスクールの school_id（紐付けテーブルはデモスクールの選手ID）を条件にしており、
 * NLTC を含む他のスクールのデータには触れない。
 *
 * 使い方:
 *   npm run demo:cleanup            … ドライラン（削除対象の件数を表示するだけ）
 *   npm run demo:cleanup -- --yes   … 実際に削除する
 */
import fs from "node:fs";
import {
  adminClient,
  countDemoSchool,
  countNltc,
  CREDENTIALS_PATH,
  DEMO_ACCOUNTS,
  deleteDemoRecords,
  findAuthUsersByEmail,
  findDemoSchool,
  isConfirmed,
  supabaseHost,
} from "./common";

async function main() {
  console.log(`接続先: ${supabaseHost()}`);

  const school = await findDemoSchool();
  const demoEmails = Object.values(DEMO_ACCOUNTS).map((a) => a.email);
  const authByEmail = await findAuthUsersByEmail(demoEmails);

  // 削除対象ユーザー = デモスクールに所属する app_users ＋ app_users 作成前に失敗して残った
  // デモ用メールアドレスの認証ユーザー（どのスクールにも所属していないものに限る）
  const targetUserIds = new Set<string>();
  if (school) {
    const { data, error } = await adminClient.from("app_users").select("id").eq("school_id", school.id);
    if (error) throw new Error(`デモスクールのユーザー取得に失敗: ${error.message}`);
    for (const u of data ?? []) targetUserIds.add(u.id);
  }
  for (const [email, id] of authByEmail) {
    if (targetUserIds.has(id)) continue;
    const { data: appUser } = await adminClient.from("app_users").select("school_id").eq("id", id).maybeSingle();
    if (appUser) {
      console.log(`  ⚠️ ${email} はデモ以外のスクールに所属しているため削除しません`);
      continue;
    }
    targetUserIds.add(id);
  }

  console.log("");
  console.log("削除対象:");
  console.log(`  デモスクール: ${school ? `${school.name}（slug: ${school.slug}）` : "なし"}`);
  if (school) console.log("  デモスクール内の件数:", await countDemoSchool(school.id));
  console.log(`  認証ユーザー: ${targetUserIds.size} 件`);
  console.log(`  ※ ${CREDENTIALS_PATH} はそのまま残します（不要なら手動で削除してください）`);

  if (!isConfirmed()) {
    console.log("");
    console.log("ドライランのため、何も削除せずに終了しました。削除するには: npm run demo:cleanup -- --yes");
    return;
  }

  const nltcBefore = await countNltc();

  console.log("");
  console.log("削除を開始します...");
  if (school) {
    // coach_notes.coach_id や daily_logs.liked_by_coach_id はユーザー削除で連動削除されない参照のため、
    // 先に記録データを消してからユーザーを削除する
    await deleteDemoRecords(school.id);
  }

  for (const id of targetUserIds) {
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) throw new Error(`認証ユーザー(${id})の削除に失敗: ${error.message}`);
  }
  console.log(`  🗑️  認証ユーザー: ${targetUserIds.size} 件（app_users / players / coaches / parents は連動削除）`);

  if (school) {
    const { error } = await adminClient.from("schools").delete().eq("id", school.id).eq("slug", "demo");
    if (error) throw new Error(`デモスクールの削除に失敗: ${error.message}`);
    console.log("  🗑️  デモスクール");
  }

  const nltcAfter = await countNltc();
  console.log("");
  console.log("NLTCの件数 実行前:", nltcBefore);
  console.log(
    "NLTCの件数 実行後:",
    nltcAfter,
    JSON.stringify(nltcBefore) === JSON.stringify(nltcAfter) ? "→ 変化なし ✅" : "→ ⚠️ 変化あり"
  );
  if (fs.existsSync(CREDENTIALS_PATH)) {
    console.log(`認証情報ファイルは残っています: ${CREDENTIALS_PATH}`);
  }
  console.log("✅ デモスクールの削除が完了しました");
}

main().catch((err) => {
  console.error(`❌ 失敗しました: ${err instanceof Error ? err.message : String(err)}`);
  console.error("途中まで削除されている可能性があります。再実行すると残りを削除します。");
  process.exit(1);
});
