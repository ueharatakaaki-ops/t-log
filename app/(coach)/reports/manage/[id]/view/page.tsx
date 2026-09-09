import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/require-staff";
import { getMonthlyReport } from "@/lib/queries/monthly-report-detail";
import { createClient } from "@/lib/supabase/server";
import { ReportWebView } from "@/components/reports/ReportWebView";
import type { MatchSummary } from "@/lib/queries/player-detail";

export default async function CoachReportWebViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const report = await getMonthlyReport(id);
  if (!report) notFound();

  const supabase = await createClient();
  const [y, m] = report.targetMonth.split("-");
  const nextMonth = m === "12" ? `${Number(y) + 1}-01-01` : `${y}-${String(Number(m) + 1).padStart(2, "0")}-01`;

  const { data: matchLogs } = await supabase
    .from("match_logs")
    .select("id, match_date, tournament_name, round, result, score")
    .eq("player_id", report.playerId)
    .gte("match_date", report.targetMonth)
    .lt("match_date", nextMonth)
    .order("match_date", { ascending: false });

  const matches: MatchSummary[] = (matchLogs ?? []).map((mlog) => ({
    id: mlog.id,
    matchDate: mlog.match_date,
    tournamentName: mlog.tournament_name,
    round: mlog.round,
    result: mlog.result,
    score: mlog.score,
  }));

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 py-8 print:bg-white">
      <ReportWebView
        playerName={report.playerName}
        periodLabel={`${y}年${Number(m)}月度（${statusLabel(report.status)}）`}
        stats={report.summaryStats!}
        matches={matches}
        technicalEvaluation={report.technicalEvaluation}
        mentalEvaluation={report.mentalEvaluation}
        connectText={report.connectText}
        agreedTheme={report.agreedTheme}
        agreedNotes={report.agreedNotes}
      />
    </main>
  );
}

function statusLabel(status: string) {
  return { draft: "下書き", reviewed: "確認済み", published: "公開済み" }[status] ?? status;
}
