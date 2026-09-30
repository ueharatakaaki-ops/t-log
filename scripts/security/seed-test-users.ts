/**
 * RLS検証用のテストユーザー・テストデータを作成する。
 * 本番データには一切触れず、専用のテスト選手・コーチ・保護者アカウントのみを作成する。
 *
 * 使い方: npm run test:rls:seed
 * 後片付け: npm run test:rls:cleanup
 *
 * 作成するデータ:
 *   - player: TEST_PLAYER_A, TEST_PLAYER_B（互いに無関係）
 *   - parent: TEST_PARENT_A（PLAYER_Aのみと紐付け）
 *   - coach:  TEST_COACH_A
 *   - PLAYER_A の daily_logs（痛みあり）、coach_notes（internal 1件・shared_with_family 1件）
 *   - school越境チェック用に、NLTCとは別のテスト用スクール（RLS_TEST_SCHOOL_B）と
 *     そこに所属する TEST_PLAYER_C・TEST_PARENT_C（あらかじめ紐付け済み）を作成する
 *     （parent_player_links/coach_player_linksのschool越境紐付けを防げているかの検証用。
 *      0013マイグレーション参照）。TEST_PARENT_C×TEST_PLAYER_Cの紐付け行を
 *      実際に1件作っておかないと、「他校のリンクが見えない」ことを確認するテストが
 *      そもそも0件（見えなくて当然）になってしまい、修正の有無を判別できない
 *      無意味なテストになってしまう点に注意。
 */
import "dotenv/config";
import { adminClient, getNltcSchoolId } from "../migration/client";

const TEST_PASSWORD = "TestPassw0rd!2026";
const TEST_SCHOOL_B_SLUG = "rls-test-school-b";

export const TEST_EMAILS = {
  playerA: "rls-test-player-a@example.com",
  playerB: "rls-test-player-b@example.com",
  playerC: "rls-test-player-c@example.com", // 別スクール（RLS_TEST_SCHOOL_B）所属。school越境確認用
  parentA: "rls-test-parent-a@example.com",
  parentB: "rls-test-parent-b@example.com", // PLAYER_Aとは無関係の保護者（アクセス不可であることの確認用）
  parentC: "rls-test-parent-c@example.com", // 別スクール（RLS_TEST_SCHOOL_B）所属。PLAYER_Cと紐付け済み
  coachA: "rls-test-coach-a@example.com",
} as const;

/** 越境テスト用に、NLTCとは別のテストスクールを作成（なければ）し、school_idを返す */
async function getOrCreateTestSchoolB(): Promise<string> {
  const { data: existing } = await adminClient.from("schools").select("id").eq("slug", TEST_SCHOOL_B_SLUG).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await adminClient
    .from("schools")
    .insert({ name: "RLS_TEST_SCHOOL_B", slug: TEST_SCHOOL_B_SLUG, plan: "internal" })
    .select("id")
    .single();
  if (error || !created) throw new Error(`テスト用スクールBの作成に失敗: ${error?.message}`);
  return created.id;
}

async function createTestUser(email: string, role: "player" | "parent" | "coach", schoolId: string, displayName: string) {
  const { data: created, error } = await adminClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !created.user) {
    throw new Error(`${email} の作成に失敗: ${error?.message}`);
  }

  const userId = created.user.id;

  const { error: appUserError } = await adminClient
    .from("app_users")
    .insert({ id: userId, school_id: schoolId, role, display_name: displayName });
  if (appUserError) throw new Error(`app_users作成失敗(${email}): ${appUserError.message}`);

  if (role === "player") {
    const { error: e } = await adminClient.from("players").insert({ id: userId, school_id: schoolId, full_name: displayName });
    if (e) throw new Error(`players作成失敗(${email}): ${e.message}`);
  } else if (role === "parent") {
    const { error: e } = await adminClient.from("parents").insert({ id: userId, school_id: schoolId });
    if (e) throw new Error(`parents作成失敗(${email}): ${e.message}`);
  } else if (role === "coach") {
    const { error: e } = await adminClient.from("coaches").insert({ id: userId, school_id: schoolId });
    if (e) throw new Error(`coaches作成失敗(${email}): ${e.message}`);
  }

  return userId;
}

async function main() {
  const schoolId = await getNltcSchoolId();
  const schoolBId = await getOrCreateTestSchoolB();

  console.log("テストユーザーを作成しています...");
  const playerAId = await createTestUser(TEST_EMAILS.playerA, "player", schoolId, "TEST_PLAYER_A");
  const playerBId = await createTestUser(TEST_EMAILS.playerB, "player", schoolId, "TEST_PLAYER_B");
  const playerCId = await createTestUser(TEST_EMAILS.playerC, "player", schoolBId, "TEST_PLAYER_C");
  const parentAId = await createTestUser(TEST_EMAILS.parentA, "parent", schoolId, "TEST_PARENT_A");
  const parentBId = await createTestUser(TEST_EMAILS.parentB, "parent", schoolId, "TEST_PARENT_B");
  const parentCId = await createTestUser(TEST_EMAILS.parentC, "parent", schoolBId, "TEST_PARENT_C");
  const coachAId = await createTestUser(TEST_EMAILS.coachA, "coach", schoolId, "TEST_COACH_A");

  console.log("紐付け・テストデータを作成しています...");
  await adminClient.from("parent_player_links").insert({ parent_id: parentAId, player_id: playerAId });
  // school越境の select リーク検証用（コメント参照）。adminClientはRLSをバイパスするため、
  // このinsert自体はschool越境チェックの検証対象ではない。
  await adminClient.from("parent_player_links").insert({ parent_id: parentCId, player_id: playerCId });

  await adminClient.from("daily_logs").insert({
    player_id: playerAId,
    school_id: schoolId,
    log_date: "2099-01-01", // 実運用データと衝突しない未来日を使う
    sleep_hours: 5,
    fatigue_level: 9,
    has_pain: true,
    pain_locations: ["肘"],
    self_score: 5,
    notes: "RLSテスト用データ",
  });

  await adminClient.from("coach_notes").insert([
    { player_id: playerAId, coach_id: coachAId, school_id: schoolId, content: "internal note (テスト)", visibility: "internal" },
    { player_id: playerAId, coach_id: coachAId, school_id: schoolId, content: "shared note (テスト)", visibility: "shared_with_family" },
  ]);

  await adminClient.from("monthly_reports").insert([
    { player_id: playerAId, school_id: schoolId, target_month: "2099-01-01", status: "draft" },
    { player_id: playerAId, school_id: schoolId, target_month: "2098-12-01", status: "published", published_at: new Date().toISOString() },
  ]);

  console.log("✅ テストユーザー・データの作成が完了しました");
  console.log({ playerAId, playerBId, playerCId, parentAId, parentBId, parentCId, coachAId });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
