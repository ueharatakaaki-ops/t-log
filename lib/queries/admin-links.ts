import { createClient } from "@/lib/supabase/server";

export type SimplePlayer = { id: string; fullName: string };
export type SimpleParent = { id: string; displayName: string };
export type SimpleCoach = { id: string; displayName: string };

export type ParentLinkRow = { parentId: string; parentName: string; playerId: string; playerName: string };
export type CoachLinkRow = { coachId: string; coachName: string; playerId: string; playerName: string };

export async function getLinkManagementData(schoolId: string) {
  const supabase = await createClient();

  const [{ data: players }, { data: appUsers }, { data: parentLinks }, { data: coachLinks }] = await Promise.all([
    supabase.from("players").select("id, full_name").eq("school_id", schoolId).eq("status", "active").order("full_name"),
    supabase.from("app_users").select("id, display_name, role").eq("school_id", schoolId),
    supabase
      .from("parent_player_links")
      .select("parent_id, player_id, players!inner(full_name, school_id)")
      .eq("players.school_id", schoolId),
    supabase
      .from("coach_player_links")
      .select("coach_id, player_id, players!inner(full_name, school_id)")
      .eq("players.school_id", schoolId),
  ]);

  const nameById = new Map((appUsers ?? []).map((u) => [u.id, u.display_name]));
  const playerNameById = new Map((players ?? []).map((p) => [p.id, p.full_name]));

  const simplePlayers: SimplePlayer[] = (players ?? []).map((p) => ({ id: p.id, fullName: p.full_name }));
  const simpleParents: SimpleParent[] = (appUsers ?? [])
    .filter((u) => u.role === "parent")
    .map((u) => ({ id: u.id, displayName: u.display_name }));
  const simpleCoaches: SimpleCoach[] = (appUsers ?? [])
    .filter((u) => u.role === "coach")
    .map((u) => ({ id: u.id, displayName: u.display_name }));

  const parentLinkRows: ParentLinkRow[] = (parentLinks ?? [])
    .filter((l) => playerNameById.has(l.player_id))
    .map((l) => ({
      parentId: l.parent_id,
      parentName: nameById.get(l.parent_id) ?? "-",
      playerId: l.player_id,
      playerName: playerNameById.get(l.player_id) ?? "-",
    }));

  const coachLinkRows: CoachLinkRow[] = (coachLinks ?? [])
    .filter((l) => playerNameById.has(l.player_id))
    .map((l) => ({
      coachId: l.coach_id,
      coachName: nameById.get(l.coach_id) ?? "-",
      playerId: l.player_id,
      playerName: playerNameById.get(l.player_id) ?? "-",
    }));

  return { simplePlayers, simpleParents, simpleCoaches, parentLinkRows, coachLinkRows };
}
