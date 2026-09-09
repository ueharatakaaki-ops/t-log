import { createClient } from "@/lib/supabase/server";

export type ReportListRow = {
  playerId: string;
  fullName: string;
  reportId: string | null;
  status: "none" | "draft" | "reviewed" | "published";
};

export async function getReportListForMonth(
  schoolId: string,
  targetMonth: string // "YYYY-MM-01"
): Promise<ReportListRow[]> {
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("players")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("full_name");

  const { data: reports } = await supabase
    .from("monthly_reports")
    .select("id, player_id, status")
    .eq("school_id", schoolId)
    .eq("target_month", targetMonth);

  const reportByPlayer = new Map((reports ?? []).map((r) => [r.player_id, r]));

  return (players ?? []).map((p) => {
    const report = reportByPlayer.get(p.id);
    return {
      playerId: p.id,
      fullName: p.full_name,
      reportId: report?.id ?? null,
      status: (report?.status as ReportListRow["status"]) ?? "none",
    };
  });
}
