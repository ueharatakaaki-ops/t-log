import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffContext = {
  userId: string;
  schoolId: string;
  role: "coach" | "school_admin" | "system_admin";
  displayName: string;
};

/**
 * コーチ・管理者専用ページ/Server Actionの先頭で呼び出す。
 * RLSがDBレベルでの最終防御になるが、UXとしては早い段階で弾いた方が親切なため
 * アプリ層でもロールチェックを行う。
 */
export async function requireStaff(): Promise<StaffContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, school_id, role, display_name")
    .eq("id", user.id)
    .single();

  if (!appUser || !["coach", "school_admin", "system_admin"].includes(appUser.role)) {
    redirect("/login");
  }

  return {
    userId: appUser.id,
    schoolId: appUser.school_id,
    role: appUser.role as StaffContext["role"],
    displayName: appUser.display_name,
  };
}
