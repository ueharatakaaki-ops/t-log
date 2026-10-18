/**
 * デモスクールの件数と、他校との隔離（RLS）を確認する。
 * 事前に npm run demo:seed -- --yes を実行しておくこと（ログインには認証情報ファイルのパスワードを使う）。
 *
 * 使い方: npm run demo:verify
 *
 * 確認内容:
 *  1. デモ選手・デモコーチとして anon キーでログインし、NLTC の players / daily_logs 等が 0 件しか見えないこと
 *  2. 使い捨ての別スクール（slug: demo-verify-other）に確認用コーチを作ってログインし、
 *     デモの選手・記録が見えないこと（＝他校のコーチからデモが見えない）。
 *     確認後は finally でユーザーとスクールごと必ず削除する。
 *  NLTC には一切書き込まない（件数の読み取りのみ）。
 */
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  countDemoSchool,
  countNltc,
  DEMO_ACCOUNTS,
  findDemoSchool,
  loadSavedPasswords,
  supabaseHost,
} from "./common";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を環境変数に設定してください");

const OTHER_SCHOOL = { name: "DEMO_VERIFY_OTHER_SCHOOL", slug: "demo-verify-other", plan: "internal" } as const;
const OTHER_COACH_EMAIL = "demo-verify-other-coach@example.com";

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  if (!ok) failures += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}（${detail}）`);
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} のログインに失敗: ${error.message}`);
  return client;
}

async function visibleCount(client: SupabaseClient, table: string, schoolId: string): Promise<number> {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true }).eq("school_id", schoolId);
  if (error) throw new Error(`${table} の取得に失敗: ${error.message}`);
  return count ?? 0;
}

/** 使い捨てスクールと確認用ユーザーを削除する（前回の実行で残っていた場合の掃除にも使う） */
async function removeOtherSchool() {
  const { data: school } = await adminClient.from("schools").select("id, slug").eq("slug", OTHER_SCHOOL.slug).maybeSingle();
  if (school && school.slug !== OTHER_SCHOOL.slug) throw new Error("安全のため中断: 想定外のスクールです");

  const userIds = new Set<string>();
  if (school) {
    const { data } = await adminClient.from("app_users").select("id").eq("school_id", school.id);
    for (const u of data ?? []) userIds.add(u.id);
  }
  // app_users 作成前に失敗した場合に備え、確認用メールアドレスの認証ユーザーも探す（どのスクールにも未所属のものに限る）
  for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`認証ユーザー一覧の取得に失敗: ${error.message}`);
    for (const u of data.users) {
      if (u.email?.toLowerCase() !== OTHER_COACH_EMAIL || userIds.has(u.id)) continue;
      const { data: appUser } = await adminClient.from("app_users").select("id").eq("id", u.id).maybeSingle();
      if (!appUser) userIds.add(u.id);
    }
    if (data.users.length < 1000) break;
  }

  for (const id of userIds) {
    // app_users / coaches は ON DELETE CASCADE で連動削除される
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) throw new Error(`確認用ユーザーの削除に失敗: ${error.message}`);
  }
  if (school) {
    const { error } = await adminClient.from("schools").delete().eq("id", school.id).eq("slug", OTHER_SCHOOL.slug);
    if (error) throw new Error(`使い捨てスクールの削除に失敗: ${error.message}`);
  }
  return { removedSchool: !!school, removedUsers: userIds.size };
}

async function checkFromOtherSchool(demoSchoolId: string) {
  const { data: school, error } = await adminClient
    .from("schools")
    .insert(OTHER_SCHOOL)
    .select("id")
    .single();
  if (error || !school) throw new Error(`使い捨てスクールの作成に失敗: ${error?.message}`);

  const password = crypto.randomBytes(18).toString("base64url"); // メモリ上のみ。表示・保存しない
  const { data: created, error: e0 } = await adminClient.auth.admin.createUser({
    email: OTHER_COACH_EMAIL,
    password,
    email_confirm: true,
  });
  if (e0 || !created.user) throw new Error(`確認用コーチの作成に失敗: ${e0?.message}`);
  const coachId = created.user.id;

  const { error: e1 } = await adminClient
    .from("app_users")
    .insert({ id: coachId, school_id: school.id, role: "coach", display_name: "DEMO_VERIFY_OTHER_COACH" });
  if (e1) throw new Error(`確認用コーチの app_users 作成に失敗: ${e1.message}`);
  const { error: e2 } = await adminClient.from("coaches").insert({ id: coachId, school_id: school.id });
  if (e2) throw new Error(`確認用コーチの coaches 作成に失敗: ${e2.message}`);

  const client = await signIn(OTHER_COACH_EMAIL, password);
  for (const table of ["players", "daily_logs", "match_logs", "coach_notes", "monthly_reports"]) {
    const n = await visibleCount(client, table, demoSchoolId);
    check(`他校のコーチから デモの ${table} が見えない`, n === 0, `見えた件数: ${n}`);
  }
  const { data: byName } = await client.from("players").select("id").eq("full_name", DEMO_ACCOUNTS.taro.displayName);
  check("他校のコーチから デモ 太郎 が名前検索でも見えない", (byName?.length ?? 0) === 0, `見えた件数: ${byName?.length ?? 0}`);
  const { data: allPlayers } = await client.from("players").select("id");
  check("他校のコーチから見える選手は 0 件（自校に選手なし）", (allPlayers?.length ?? 0) === 0, `見えた件数: ${allPlayers?.length ?? 0}`);
}

async function main() {
  console.log(`接続先: ${supabaseHost()}`);
  const demo = await findDemoSchool();
  if (!demo) throw new Error("デモスクールがありません。先に npm run demo:seed -- --yes を実行してください");
  const { data: nltc } = await adminClient.from("schools").select("id").eq("slug", "nltc").single();
  if (!nltc) throw new Error("NLTCのスクールが見つかりません");

  console.log("");
  console.log("デモスクール内の件数:", await countDemoSchool(demo.id));
  const nltcBefore = await countNltc();
  console.log("NLTCの件数:", nltcBefore);
  console.log("");

  const passwords = loadSavedPasswords();
  const pw = (key: keyof typeof DEMO_ACCOUNTS) => {
    const p = passwords.get(DEMO_ACCOUNTS[key].email.toLowerCase());
    if (!p) throw new Error(`${DEMO_ACCOUNTS[key].email} のパスワードが認証情報ファイルにありません`);
    return p;
  };

  // デモ選手からNLTCが見えないこと
  for (const key of ["taro", "hanako"] as const) {
    const client = await signIn(DEMO_ACCOUNTS[key].email, pw(key));
    const name = DEMO_ACCOUNTS[key].displayName;
    for (const table of ["players", "daily_logs"]) {
      const n = await visibleCount(client, table, nltc.id);
      check(`${name} から NLTC の ${table} が見えない`, n === 0, `見えた件数: ${n}`);
    }
    const { data: self } = await client.auth.getUser();
    const { data: visibleLogs } = await client.from("daily_logs").select("player_id");
    const others = (visibleLogs ?? []).filter((l) => l.player_id !== self.user?.id).length;
    check(`${name} は自分以外の daily_logs が見えない`, others === 0, `自分以外: ${others} 件 / 自分: ${(visibleLogs ?? []).length - others} 件`);
  }

  // デモコーチからNLTCが見えないこと（デモの選手は見える）
  {
    const client = await signIn(DEMO_ACCOUNTS.coach.email, pw("coach"));
    for (const table of ["players", "daily_logs", "monthly_reports"]) {
      const n = await visibleCount(client, table, nltc.id);
      check(`デモ コーチ から NLTC の ${table} が見えない`, n === 0, `見えた件数: ${n}`);
    }
    const n = await visibleCount(client, "players", demo.id);
    check("デモ コーチ はデモスクールの選手が見える", n === 2, `見えた件数: ${n}`);
  }

  // 他校（使い捨てスクール）のコーチからデモが見えないこと
  await removeOtherSchool(); // 前回の残りがあれば掃除してから作る
  try {
    await checkFromOtherSchool(demo.id);
  } finally {
    const r = await removeOtherSchool();
    console.log(`   使い捨てスクールを削除しました（スクール: ${r.removedSchool ? 1 : 0} 件 / ユーザー: ${r.removedUsers} 件）`);
  }
  const { count: leftover } = await adminClient
    .from("schools")
    .select("*", { count: "exact", head: true })
    .eq("slug", OTHER_SCHOOL.slug);
  check("使い捨てスクールが残っていない", (leftover ?? 0) === 0, `残り: ${leftover ?? 0} 件`);

  const nltcAfter = await countNltc();
  check("NLTC の件数が確認の前後で変わっていない", JSON.stringify(nltcBefore) === JSON.stringify(nltcAfter), JSON.stringify(nltcAfter));

  console.log("");
  if (failures > 0) {
    console.log(`❌ ${failures} 件の確認に失敗しました`);
    process.exit(1);
  }
  console.log("✅ すべての確認に成功しました");
}

main().catch((err) => {
  console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
