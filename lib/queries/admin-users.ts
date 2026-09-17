import { createClient } from "@/lib/supabase/server";

export type AdminUserRow = {
  id: string;
  displayName: string;
  role: string;
  createdAt: string;
};

export async function getSchoolUsers(schoolId: string): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_users")
    .select("id, display_name, role, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((u) => ({
    id: u.id,
    displayName: u.display_name,
    role: u.role,
    createdAt: u.created_at,
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

  return {
    id: user.id,
    displayName: user.display_name,
    role: user.role,
    createdAt: user.created_at,
    hasCoachProfile: !!coachRow,
  };
}
