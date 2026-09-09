/**
 * RLS（Row Level Security）の権限分離を検証する統合テスト。
 *
 * 事前に npm run test:rls:seed を実行しておくこと。
 * 使い方: npm run test:rls
 * 終了後: npm run test:rls:cleanup
 *
 * anonキーのクライアントで各テストユーザーとしてログインし、
 * 「見えるべきものが見える」「見えるべきでないものが見えない」の両方を確認する。
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { TEST_EMAILS } from "./seed-test-users";

const TEST_PASSWORD = "TestPassw0rd!2026";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を環境変数に設定してください");
}

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

async function signInAs(email: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`${email} のログインに失敗: ${error.message}（先に npm run test:rls:seed を実行しましたか？）`);
  return client;
}

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`✅ ${name}`);
  } catch (err) {
    results.push({ name, pass: false, detail: (err as Error).message });
    console.log(`❌ ${name} — ${(err as Error).message}`);
  }
}

async function main() {
  const playerA = await signInAs(TEST_EMAILS.playerA);
  const playerB = await signInAs(TEST_EMAILS.playerB);
  const parentA = await signInAs(TEST_EMAILS.parentA);
  const parentB = await signInAs(TEST_EMAILS.parentB);
  const coachA = await signInAs(TEST_EMAILS.coachA);

  // player_idはテストユーザー自身のauth.uidと一致する（players.id = app_users.id = auth.users.id）
  const { data: aUser } = await playerA.auth.getUser();
  const { data: bUser } = await playerB.auth.getUser();
  const playerAId = aUser.user!.id;
  const playerBId = bUser.user!.id;

  await check("PLAYER_A は自分のdaily_logsを閲覧できる", async () => {
    const { data, error } = await playerA.from("daily_logs").select("*").eq("player_id", playerAId).eq("log_date", "2099-01-01");
    if (error) throw error;
    assert.equal(data?.length, 1, `期待: 1件, 実際: ${data?.length}`);
  });

  await check("PLAYER_B は PLAYER_A のdaily_logsを閲覧できない", async () => {
    const { data, error } = await playerB.from("daily_logs").select("*").eq("player_id", playerAId).eq("log_date", "2099-01-01");
    if (error) throw error;
    assert.equal(data?.length, 0, `期待: 0件（見えてはいけない）, 実際: ${data?.length}`);
  });

  await check("紐付けのない PARENT_B は PLAYER_A のdaily_logsを閲覧できない", async () => {
    const { data, error } = await parentB.from("daily_logs").select("*").eq("player_id", playerAId).eq("log_date", "2099-01-01");
    if (error) throw error;
    assert.equal(data?.length, 0, `期待: 0件（見えてはいけない）, 実際: ${data?.length}`);
  });

  await check("紐付けのある PARENT_A は PLAYER_A のdaily_logsを閲覧できる（全データ開示方針）", async () => {
    const { data, error } = await parentA.from("daily_logs").select("*").eq("player_id", playerAId).eq("log_date", "2099-01-01");
    if (error) throw error;
    assert.equal(data?.length, 1, `期待: 1件, 実際: ${data?.length}`);
    assert.equal(data?.[0].has_pain, true);
  });

  await check("PLAYER_A は internal な coach_notes を閲覧できない", async () => {
    const { data, error } = await playerA.from("coach_notes").select("*").eq("player_id", playerAId).eq("visibility", "internal");
    if (error) throw error;
    assert.equal(data?.length, 0, `期待: 0件（internalは見えてはいけない）, 実際: ${data?.length}`);
  });

  await check("PLAYER_A は shared_with_family な coach_notes を閲覧できる", async () => {
    const { data, error } = await playerA.from("coach_notes").select("*").eq("player_id", playerAId).eq("visibility", "shared_with_family");
    if (error) throw error;
    assert.equal(data?.length, 1, `期待: 1件, 実際: ${data?.length}`);
  });

  await check("PARENT_A は internal な coach_notes を閲覧できない", async () => {
    const { data, error } = await parentA.from("coach_notes").select("*").eq("player_id", playerAId).eq("visibility", "internal");
    if (error) throw error;
    assert.equal(data?.length, 0, `期待: 0件（internalは見えてはいけない）, 実際: ${data?.length}`);
  });

  await check("COACH_A（staff）は internal / shared_with_family 両方の coach_notes を閲覧できる", async () => {
    const { data, error } = await coachA.from("coach_notes").select("*").eq("player_id", playerAId);
    if (error) throw error;
    assert.equal(data?.length, 2, `期待: 2件, 実際: ${data?.length}`);
  });

  await check("PLAYER_A は自分の published レポートを閲覧できる", async () => {
    const { data, error } = await playerA.from("monthly_reports").select("*").eq("player_id", playerAId).eq("status", "published");
    if (error) throw error;
    assert.equal(data?.length, 1, `期待: 1件, 実際: ${data?.length}`);
  });

  await check("PLAYER_A は自分の draft レポートを閲覧できない", async () => {
    const { data, error } = await playerA.from("monthly_reports").select("*").eq("player_id", playerAId).eq("status", "draft");
    if (error) throw error;
    assert.equal(data?.length, 0, `期待: 0件（draftは見えてはいけない）, 実際: ${data?.length}`);
  });

  await check("COACH_A は draft レポートも閲覧できる", async () => {
    const { data, error } = await coachA.from("monthly_reports").select("*").eq("player_id", playerAId).eq("status", "draft");
    if (error) throw error;
    assert.equal(data?.length, 1, `期待: 1件, 実際: ${data?.length}`);
  });

  await check("PLAYER_A は PLAYER_B のdaily_logsを更新できない（RLSにより対象0件）", async () => {
    const { data, error } = await playerA
      .from("daily_logs")
      .update({ notes: "不正な更新テスト" })
      .eq("player_id", playerBId)
      .select();
    if (error) throw error;
    assert.equal(data?.length, 0, `期待: 0件（更新できてはいけない）, 実際: ${data?.length}`);
  });

  await check("PLAYER_A は players テーブルに直接自分のロールを school_admin へ書き換えられない", async () => {
    // players.update RLSポリシーは is_staff() のみを許可しているため、選手からの更新は0件になるはず
    const { data, error } = await playerA.from("players").update({ grade: "不正な更新テスト" }).eq("id", playerAId).select();
    if (error) throw error;
    assert.equal(data?.length, 0, `期待: 0件（更新できてはいけない）, 実際: ${data?.length}`);
  });

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n=== 結果: ${passCount}/${results.length} 件 PASS ===`);

  if (passCount !== results.length) {
    console.error("\n❌ 失敗したテストがあります。RLSポリシーを確認してください:");
    results.filter((r) => !r.pass).forEach((r) => console.error(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
