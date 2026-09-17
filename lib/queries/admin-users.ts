import { createClient } from "@/lib/supabase/server";

export type AdminUserRow = {
  id: string;
  displayName: string;
  role: string;
  createdAt: string;
  // 選手のみ対象。生年月日は本人が初回ログイン時に入力するため、
  // 招待直後はnull（＝未ログイン、または未入力）になり得る。
  birthdateMissing: boolean;
};

export async function getSchoolUsers(schoolId: string): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_users")
    .select("id, display_name, role, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  const { data: players } = await supabase.from("players").select("id, birthdate").eq("school_id", schoolId);
  const missingBirthdateIds = new Set((players ?? []).filter((p) => !p.birthdate).map((p) => p.id));

  return (data ?? []).map((u) => ({
    id: u.id,
    displayName: u.display_name,
    role: u.role,
    createdAt: u.created_at,
    birthdateMissing: u.role === "player" && missingBirthdateIds.has(u.id),
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
  };
}
