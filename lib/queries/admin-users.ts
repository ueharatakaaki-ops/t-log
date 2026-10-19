import { createAdminClient, createClient } from "@/lib/supabase/server";

export type AdminUserRow = {
  id: string;
  displayName: string;
  role: string;
  createdAt: string;
  // 選手のみ対象。生年月日は本人が初回ログイン時に入力するため、
  // 招待直後はnull（＝未ログイン、または未入力）になり得る。
  birthdateMissing: boolean;
  auth: AuthStatus | null;
};

/**
 * 登録状況（管理画面で「招待したまま止まっている人」を見つけるため）。
 * registered: 招待・再設定リンク（またはコード）の確認が済んでいるか（Supabase の email_confirmed_at）。
 * 注意: リンクを確認した直後にパスワード設定画面で止まった人は registered=true になる
 * （Supabase はパスワードの有無を返さない）。lastSignInAt と合わせて判断する。
 */
export type AuthStatus = {
  registered: boolean;
  invitedAt: string | null;
  lastSignInAt: string | null;
};

const LIST_USERS_PER_PAGE = 1000;
const LIST_USERS_MAX_PAGES = 50;

function toAuthStatus(u: {
  email_confirmed_at?: string | null;
  invited_at?: string | null;
  confirmation_sent_at?: string | null;
  last_sign_in_at?: string | null;
}): AuthStatus {
  return {
    registered: !!u.email_confirmed_at,
    invitedAt: u.invited_at ?? u.confirmation_sent_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
  };
}

/**
 * 指定したユーザーIDの登録状況を、auth.admin.listUsers をページングして取得する。
 * Auth の管理APIにはID指定の一括取得が無いため、1ページ1000件で読み、
 * 必要なIDがすべて見つかった時点で打ち切る（ユーザーごとに getUserById を呼ぶ N+1 にしない）。
 * メールアドレス等、登録状況以外の値は返さない。
 * 呼び出し元で requireAdmin 済みであること（service role を使うため）。
 */
export async function getAuthStatuses(userIds: string[]): Promise<Map<string, AuthStatus>> {
  const wanted = new Set(userIds);
  const result = new Map<string, AuthStatus>();
  if (wanted.size === 0) return result;

  const supabaseAdmin = createAdminClient();
  for (let page = 1; page <= LIST_USERS_MAX_PAGES && result.size < wanted.size; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: LIST_USERS_PER_PAGE });
    if (error) {
      console.error("listUsers failed:", error.message);
      break;
    }
    for (const u of data.users) {
      if (wanted.has(u.id)) result.set(u.id, toAuthStatus(u));
    }
    if (data.users.length < LIST_USERS_PER_PAGE) break;
  }
  return result;
}

export async function getSchoolUsers(schoolId: string): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_users")
    .select("id, display_name, role, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  const { data: players } = await supabase.from("players").select("id, birthdate").eq("school_id", schoolId);
  const missingBirthdateIds = new Set((players ?? []).filter((p) => !p.birthdate).map((p) => p.id));
  const authStatuses = await getAuthStatuses((data ?? []).map((u) => u.id));

  return (data ?? []).map((u) => ({
    id: u.id,
    displayName: u.display_name,
    role: u.role,
    createdAt: u.created_at,
    birthdateMissing: u.role === "player" && missingBirthdateIds.has(u.id),
    auth: authStatuses.get(u.id) ?? null,
  }));
}

export type AdminUserDetail = {
  id: string;
  displayName: string;
  role: string;
  createdAt: string;
  // coachesテーブルに行があるか＝コーチメモ等のコーチ専用機能を使えるかどうか。
  // school_admin×コーチ兼任のケースを判定するために使う。
  hasCoachProfile: boolean;
  // 選手の場合のみ使う。招待時には設定せず本人が初回ログイン時に入力するため、
  // 未登録（null）のこともある。
  birthdate: string | null;
  auth: AuthStatus | null;
};

export async function getUserDetail(userId: string, schoolId: string): Promise<AdminUserDetail | null> {
  const supabase = await createClient();

  const { data: user } = await supabase
    .from("app_users")
    .select("id, display_name, role, created_at")
    .eq("id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!user) return null;

  const { data: coachRow } = await supabase.from("coaches").select("id").eq("id", userId).maybeSingle();

  let birthdate: string | null = null;
  if (user.role === "player") {
    const { data: playerRow } = await supabase.from("players").select("birthdate").eq("id", userId).maybeSingle();
    birthdate = playerRow?.birthdate ?? null;
  }

  return {
    id: user.id,
    displayName: user.display_name,
    role: user.role,
    createdAt: user.created_at,
    hasCoachProfile: !!coachRow,
    birthdate,
    auth: await getAuthStatusById(user.id),
  };
}

/** 詳細画面用: 1人分の登録状況。呼び出し元で自校のユーザーであることを確認済みであること */
async function getAuthStatusById(userId: string): Promise<AuthStatus | null> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return toAuthStatus(data.user);
}
