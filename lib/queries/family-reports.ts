import { createClient } from "@/lib/supabase/server";

export type PublishedReportRow = {
  id: string;
  targetMonth: string;
  publishedAt: string | null;
};

/** 指定した選手の公開済み月次レポート一覧を新しい順で取得する（RLSにより閲覧権限のない選手は取得できない） */
export async function getPublishedReports(playerId: string): Promise<PublishedReportRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("monthly_reports")
    .select("id, target_month, published_at")
    .eq("player_id", playerId)
    .eq("status", "published")
    .order("target_month", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    targetMonth: r.target_month,
    publishedAt: r.published_at,
  }));
}

export type ChildProfile = {
  id: string;
  fullName: string;
  category: string | null;
};

/** 保護者が閲覧できる子どもの一覧を取得する */
export async function getChildProfiles(childPlayerIds: string[]): Promise<ChildProfile[]> {
  if (childPlayerIds.length === 0) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("players")
    .select("id, full_name, category")
    .in("id", childPlayerIds)
    .order("full_name");

  return (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name, category: p.category }));
}
