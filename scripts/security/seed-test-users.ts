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
 */
import "dotenv/config";
import { adminClient, getNltcSchoolId } from "../migration/client";

const TEST_PASSWORD = "TestPassw0rd!2026";

export const TEST_EMAILS = {
  playerA: "rls-test-player-a@example.com",
  playerB: "rls-test-player-b@example.com",
  parentA: "rls-test-parent-a@example.com",
  parentB: "rls-test-parent-b@example.com", // PLAYER_Aとは無関係の保護者（アクセス不可であることの確認用）
  coachA: "rls-test-coach-a@example.com",
} as const;

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

  console.log("テストユーザーを作成しています...");
  const playerAId = await createTestUser(TEST_EMAILS.playerA, "player", schoolId, "TEST_PLAYER_A");
  const playerBId = await createTestUser(TEST_EMAILS.playerB, "player", schoolId, "TEST_PLAYER_B");
  const parentAId = await createTestUser(TEST_EMAILS.parentA, "parent", schoolId, "TEST_PARENT_A");
  const parentBId = await createTestUser(TEST_EMAILS.parentB, "parent", schoolId, "TEST_PARENT_B");
  const coachAId = await createTestUser(TEST_EMAILS.coachA, "coach", schoolId, "TEST_COACH_A");

  console.log("紐付け・テストデータを作成しています...");
  await adminClient.from("parent_player_links").insert({ parent_id: parentAId, player_id: playerAId });

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
  console.log({ playerAId, playerBId, parentAId, parentBId, coachAId });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
