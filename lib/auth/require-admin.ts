import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminContext = {
  userId: string;
  schoolId: string;
  role: "school_admin" | "system_admin";
};

/**
 * アカウント発行・選手/コーチ/保護者の紐付け変更など、権限に直結する操作は
 * coach ロールには許可せず school_admin / system_admin に限定する。
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, school_id, role")
    .eq("id", user.id)
    .single();

  if (!appUser || !["school_admin", "system_admin"].includes(appUser.role)) {
    redirect("/login");
  }

  return { userId: appUser.id, schoolId: appUser.school_id, role: appUser.role as AdminContext["role"] };
}

/**
 * 全スクール横断のデータ（スクール一覧・登録者数集計など）を見られるのは
 * system_admin のみに限定する。school_admin は自校の管理はできるが、
 * 他校の登録者数等を見ることはできない。
 */
export async function requireSystemAdmin(): Promise<AdminContext> {
  const admin = await requireAdmin();
  if (admin.role !== "system_admin") {
    redirect("/admin/users");
  }
  return admin;
}
