/**
 * デモスクール（slug: demo）用スクリプトの共通処理。
 *
 * 重要: ここにある削除・集計処理は、必ずデモスクールの school_id を条件にする。
 * NLTC（slug: nltc）を含む他のスクールのデータには一切触れないこと。
 */
import "./env";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adminClient } from "../migration/client";

export { adminClient };

export const DEMO_SCHOOL = {
  name: "t-logデモスクール",
  slug: "demo",
  plan: "demo",
} as const;

/** 誤って他校を対象にしないための、絶対に操作してはいけない slug */
const PROTECTED_SLUGS = ["nltc"];

export type DemoRole = "school_admin" | "coach" | "player" | "parent";

export type DemoAccountKey = "admin" | "coach" | "taro" | "hanako" | "parent";

export const DEMO_ACCOUNTS: Record<DemoAccountKey, { email: string; role: DemoRole; displayName: string }> = {
  admin: { email: "ueharatakaaki+demo-admin@gmail.com", role: "school_admin", displayName: "デモ 管理者" },
  coach: { email: "ueharatakaaki+demo-coach@gmail.com", role: "coach", displayName: "デモ コーチ" },
  taro: { email: "ueharatakaaki+demo-taro@gmail.com", role: "player", displayName: "デモ 太郎" },
  hanako: { email: "ueharatakaaki+demo-hanako@gmail.com", role: "player", displayName: "デモ 花子" },
  parent: { email: "ueharatakaaki+demo-parent@gmail.com", role: "parent", displayName: "デモ 保護者" },
};

/** パスワードの保存先。リポジトリの外（ホームフォルダ）に置く */
export const CREDENTIALS_PATH = path.join(os.homedir(), "t-log-demo-credentials.txt");

/** 認証情報ファイルから、メール → パスワード を読み込む（seed の再実行・verify のログインで使う） */
export function loadSavedPasswords(): Map<string, string> {
  const saved = new Map<string, string>();
  if (!fs.existsSync(CREDENTIALS_PATH)) return saved;
  const lines = fs.readFileSync(CREDENTIALS_PATH, "utf8").split(/\r?\n/);
  let email: string | null = null;
  for (const line of lines) {
    const e = line.match(/^\s*email:\s*(\S+)/);
    const p = line.match(/^\s*password:\s*(\S+)/);
    if (e) email = e[1].toLowerCase();
    else if (p && email) {
      saved.set(email, p[1]);
      email = null;
    }
  }
  return saved;
}

/**
 * デモスクールに属するデータを持つテーブル（すべて school_id 列を持つ）。
 * 外部キーの参照順（参照する側が先）に並べており、この順に削除する。
 */
export const SCHOOL_SCOPED_TABLES = [
  "goal_log_edits",
  "coach_notes",
  "monthly_reports",
  "match_logs",
  "tournament_schedules",
  "goal_logs",
  "daily_logs",
  "physical_measurements",
  "audit_logs",
  "migration_name_map",
  "migration_duplicates",
] as const;

export function supabaseHost(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return new URL(url).host;
  } catch {
    return "(不明)";
  }
}

/** --yes が付いていなければドライラン */
export function isConfirmed(): boolean {
  return process.argv.slice(2).includes("--yes");
}

/** slug=demo のスクールを取得する（なければ null）。万一 NLTC 等を指していたら中断する */
export async function findDemoSchool(): Promise<{ id: string; name: string; slug: string; plan: string } | null> {
  const { data, error } = await adminClient
    .from("schools")
    .select("id, name, slug, plan")
    .eq("slug", DEMO_SCHOOL.slug)
    .maybeSingle();
  if (error) throw new Error(`デモスクールの取得に失敗: ${error.message}`);
  if (data) assertDemoSchool(data);
  return data;
}

export function assertDemoSchool(school: { slug: string; plan?: string }) {
  if (school.slug !== DEMO_SCHOOL.slug || PROTECTED_SLUGS.includes(school.slug)) {
    throw new Error(`安全のため中断: 対象スクールの slug が "${school.slug}" です（"demo" 以外は操作しません）`);
  }
}

/** auth.users をページングしながら全件取得し、メールアドレス → ユーザーID の Map を返す */
export async function findAuthUsersByEmail(emails: string[]): Promise<Map<string, string>> {
  const wanted = new Set(emails.map((e) => e.toLowerCase()));
  const found = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`認証ユーザー一覧の取得に失敗: ${error.message}`);
    for (const u of data.users) {
      const email = u.email?.toLowerCase();
      if (email && wanted.has(email)) found.set(email, u.id);
    }
    if (data.users.length < 1000) break;
  }
  return found;
}

/** 指定スクールの選手ID一覧 */
export async function playerIdsOf(schoolId: string): Promise<string[]> {
  const { data, error } = await adminClient.from("players").select("id").eq("school_id", schoolId);
  if (error) throw new Error(`選手一覧の取得に失敗: ${error.message}`);
  return (data ?? []).map((p) => p.id);
}

/**
 * デモスクールの記録データ（ユーザー・スクール自体は残す）を削除する。
 * seed の再実行時（日付を実行日基準で作り直す）と cleanup の両方で使う。
 */
export async function deleteDemoRecords(schoolId: string, log: (msg: string) => void = console.log) {
  const { data: school } = await adminClient.from("schools").select("slug").eq("id", schoolId).single();
  if (!school) throw new Error("対象スクールが見つかりません");
  assertDemoSchool(school);

  for (const table of SCHOOL_SCOPED_TABLES) {
    const { count, error } = await adminClient.from(table).delete({ count: "exact" }).eq("school_id", schoolId);
    if (error) throw new Error(`${table} の削除に失敗: ${error.message}`);
    if (count) log(`  🗑️  ${table}: ${count} 件`);
  }

  // 紐付けテーブルは school_id 列を持たないため、デモスクールの選手IDで絞り込む
  const playerIds = await playerIdsOf(schoolId);
  if (playerIds.length > 0) {
    for (const table of ["parent_player_links", "coach_player_links"] as const) {
      const { count, error } = await adminClient.from(table).delete({ count: "exact" }).in("player_id", playerIds);
      if (error) throw new Error(`${table} の削除に失敗: ${error.message}`);
      if (count) log(`  🗑️  ${table}: ${count} 件`);
    }
  }
}

async function countWhere(table: string, column: string, value: string): Promise<number> {
  const { count, error } = await adminClient.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw new Error(`${table} の件数取得に失敗: ${error.message}`);
  return count ?? 0;
}

/** デモスクール内の各テーブルの件数 */
export async function countDemoSchool(schoolId: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of ["app_users", "players", "coaches", "parents", ...SCHOOL_SCOPED_TABLES]) {
    result[table] = await countWhere(table, "school_id", schoolId);
  }
  const playerIds = await playerIdsOf(schoolId);
  for (const table of ["parent_player_links", "coach_player_links"] as const) {
    if (playerIds.length === 0) {
      result[table] = 0;
      continue;
    }
    const { count, error } = await adminClient
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("player_id", playerIds);
    if (error) throw new Error(`${table} の件数取得に失敗: ${error.message}`);
    result[table] = count ?? 0;
  }
  return result;
}

/** 実行前後の比較用に、NLTCの件数だけを読み取る（書き込みは一切しない） */
export async function countNltc(): Promise<Record<string, number> | null> {
  const { data } = await adminClient.from("schools").select("id").eq("slug", "nltc").maybeSingle();
  if (!data) return null;
  const result: Record<string, number> = {};
  for (const table of ["players", "daily_logs", "monthly_reports"]) {
    result[table] = await countWhere(table, "school_id", data.id);
  }
  return result;
}
