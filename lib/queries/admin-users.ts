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
