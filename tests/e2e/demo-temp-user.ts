// E2Eテスト用: デモスクール（slug: demo）に、テストごとの使い捨てユーザー（保護者ロール）を作る・消す。
// メールアドレスはデモ管理者アカウント（あなたの Gmail のプラスアドレス）から派生させる。
// generateLink はメールを送らないため、招待・再設定のテストでメールは1通も送られない。
// 既存のデモアカウント（花子など）のパスワードは変えない（変えると他のテストのログインが壊れる）。
// メールアドレス・トークン・パスワードはテストの出力に出さないこと。
import "../../scripts/demo/env";
import { adminClient, assertDemoSchool, DEMO_ACCOUNTS, findDemoSchool } from "../../scripts/demo/common";

export const TEMP_DISPLAY_NAME = "E2E 一時ユーザー";

export type TempUser = { id: string; email: string; schoolId: string | null };

export type LinkProps = { hashedToken: string; otp: string; type: "invite" | "recovery" };

function tempEmail(tag: string): string {
  const [local, domain] = DEMO_ACCOUNTS.admin.email.split("@");
  const base = local.split("+")[0];
  return `${base}+tlog-e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${domain}`;
}

/**
 * 未登録（招待済み）の使い捨てユーザーを作る。
 * inSchool=false のときは app_users を作らない（「自校のユーザーではない」ケースの確認用）。
 */
export async function createTempUser(
  tag: string,
  opts: { inSchool?: boolean } = {}
): Promise<{ user: TempUser; invite: LinkProps }> {
  const inSchool = opts.inSchool ?? true;
  const email = tempEmail(tag);
  const { data, error } = await adminClient.auth.admin.generateLink({ type: "invite", email });
  if (error || !data.user) throw new Error(`一時ユーザーを作れません: ${error?.message}`);
  const id = data.user.id;

  let schoolId: string | null = null;
  if (inSchool) {
    const school = await findDemoSchool();
    if (!school) throw new Error("デモスクールがありません");
    assertDemoSchool(school);
    schoolId = school.id;
    const { error: e1 } = await adminClient
      .from("app_users")
      .insert({ id, school_id: school.id, role: "parent", display_name: TEMP_DISPLAY_NAME });
    if (e1) throw new Error(`app_users の作成に失敗: ${e1.message}`);
    const { error: e2 } = await adminClient.from("parents").insert({ id, school_id: school.id });
    if (e2) throw new Error(`parents の作成に失敗: ${e2.message}`);
  }

  return {
    user: { id, email, schoolId },
    invite: { hashedToken: data.properties.hashed_token, otp: data.properties.email_otp, type: "invite" },
  };
}

/** 同じユーザーにリンクを作り直す（前の同じ type のリンクは無効になる） */
export async function generateLinkFor(user: TempUser, type: "invite" | "recovery"): Promise<LinkProps> {
  const { data, error } = await adminClient.auth.admin.generateLink({ type, email: user.email });
  if (error) throw new Error(`リンクを作れません(${type}): ${error.message}`);
  return { hashedToken: data.properties.hashed_token, otp: data.properties.email_otp, type };
}

export async function getAuthUpdatedAt(user: TempUser): Promise<string | undefined> {
  const { data } = await adminClient.auth.admin.getUserById(user.id);
  return data.user?.updated_at;
}

export async function countAccessLinkAudits(user: TempUser): Promise<number> {
  const { count } = await adminClient
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("target_table", "auth_access_link")
    .eq("target_id", user.id);
  return count ?? 0;
}

/** 後片付け: 監査ログ（このユーザーが対象のもの）と認証ユーザーを消す（app_users・parents は連鎖削除） */
export async function deleteTempUser(user: TempUser | undefined): Promise<void> {
  if (!user) return;
  if (user.schoolId) {
    await adminClient.from("audit_logs").delete().eq("school_id", user.schoolId).eq("target_id", user.id);
  }
  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`一時ユーザーの削除に失敗: ${error.message}`);
}

/** 念のため: 過去のテストが途中で止まって残った一時ユーザー（デモスクール内・表示名で判定）を消す */
export async function deleteLeftoverTempUsers(): Promise<number> {
  const school = await findDemoSchool();
  if (!school) return 0;
  assertDemoSchool(school);
  const { data } = await adminClient
    .from("app_users")
    .select("id")
    .eq("school_id", school.id)
    .eq("display_name", TEMP_DISPLAY_NAME);
  for (const row of data ?? []) {
    await adminClient.from("audit_logs").delete().eq("school_id", school.id).eq("target_id", row.id);
    await adminClient.auth.admin.deleteUser(row.id);
  }
  return data?.length ?? 0;
}
