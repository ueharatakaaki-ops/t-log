import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FamilyContext =
  | { role: "player"; userId: string; schoolId: string; ownPlayerId: string }
  | { role: "parent"; userId: string; schoolId: string; childPlayerIds: string[] };

/** 選手本人・保護者専用ページ/Server Actionの先頭で呼び出す */
export async function requireFamily(): Promise<FamilyContext> {
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

  if (!appUser || !["player", "parent"].includes(appUser.role)) {
    redirect("/login");
  }

  if (appUser.role === "player") {
    return { role: "player", userId: appUser.id, schoolId: appUser.school_id, ownPlayerId: appUser.id };
  }

  const { data: links } = await supabase
    .from("parent_player_links")
    .select("player_id")
    .eq("parent_id", appUser.id);

  return {
    role: "parent",
    userId: appUser.id,
    schoolId: appUser.school_id,
    childPlayerIds: (links ?? []).map((l) => l.player_id),
  };
}
