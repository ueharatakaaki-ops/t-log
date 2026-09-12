import { notFound } from "next/navigation";
import { requireFamily } from "@/lib/auth/require-family";
import { createClient } from "@/lib/supabase/server";
import { ReportWebView } from "@/components/reports/ReportWebView";
import type { MonthlyReportSummaryStats } from "@/lib/reports/compute-summary-stats";
import type { MatchSummary } from "@/lib/queries/player-detail";

export default async function FamilyReportWebViewPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const ctx = await requireFamily();
  const { reportId } = await params;
  const supabase = await createClient();

  // RLS（published状態かつ本人/紐づく保護者のみ）が最終的なアクセス制御を行う
  const { data: report } = await supabase
    .from("monthly_reports")
    .select(
      "player_id, target_month, status, summary_stats, technical_evaluation, mental_evaluation, connect_text, agreed_theme, agreed_notes, players(full_name)"
    )
    .eq("id", reportId)
    .eq("status", "published")
    .maybeSingle();

  if (!report) notFound();

  const allowed =
    (ctx.role === "player" && ctx.ownPlayerId === report.player_id) ||
    (ctx.role === "parent" && ctx.childPlayerIds.includes(report.player_id));
  if (!allowed) notFound();

  const [y, m] = report.target_month.slice(0, 7).split("-");
  const nextMonth = m === "12" ? `${Number(y) + 1}-01-01` : `${y}-${String(Number(m) + 1).padStart(2, "0")}-01`;

  const { data: matchLogs } = await supabase
    .from("match_logs")
    .select("id, match_date, tournament_name, round, result, score, good_points, bad_next_points")
    .eq("player_id", report.player_id)
    .gte("match_date", report.target_month)
    .lt("match_date", nextMonth)
    .order("match_date", { ascending: false });

  const matches: MatchSummary[] = (matchLogs ?? []).map((m) => ({
    id: m.id,
    matchDate: m.match_date,
    tournamentName: m.tournament_name,
    round: m.round,
    result: m.result,
    score: m.score,
    goodPoints: m.good_points,
    badNextPoints: m.bad_next_points,
  }));

  const player = Array.isArray(report.players) ? report.players[0] : report.players;

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 py-8 print:bg-white">
      <ReportWebView
        playerName={player?.full_name ?? ""}
        periodLabel={`${y}年${Number(m)}月度`}
        stats={report.summary_stats as MonthlyReportSummaryStats}
        matches={matches}
        technicalEvaluation={report.technical_evaluation}
        mentalEvaluation={report.mental_evaluation}
        connectText={report.connect_text}
        agreedTheme={report.agreed_theme}
        agreedNotes={report.agreed_notes}
      />
    </main>
  );
}
