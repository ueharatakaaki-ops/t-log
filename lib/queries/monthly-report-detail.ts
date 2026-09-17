import { createClient } from "@/lib/supabase/server";
import { computeSchoolGrade } from "@/lib/date";
import type { MonthlyReportSummaryStats } from "@/lib/reports/compute-summary-stats";

export type MonthlyReportDetail = {
  id: string;
  playerId: string;
  playerName: string;
  birthdate: string | null;
  gradeLabel: string | null; // 対象月時点での学年（生年月日から自動計算）
  targetMonth: string;
  status: "draft" | "reviewed" | "published";
  summaryStats: MonthlyReportSummaryStats | null;
  connectText: string | null;
  technicalEvaluation: string | null;
  mentalEvaluation: string | null;
  agreedTheme: string | null;
  agreedNotes: string | null;
  pdfPath: string | null;
  publishedAt: string | null;
};

export async function getMonthlyReport(reportId: string): Promise<MonthlyReportDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("monthly_reports")
    .select(
      `id, player_id, target_month, status, summary_stats, connect_text,
       technical_evaluation, mental_evaluation, agreed_theme, agreed_notes,
       pdf_path, published_at,
       players ( full_name, birthdate )`
    )
    .eq("id", reportId)
    .maybeSingle();

  if (!data) return null;

  // Supabaseのネスト取得は配列/オブジェクトどちらの型定義にもなり得るため吸収する
  const player = Array.isArray(data.players) ? data.players[0] : data.players;

  return {
    id: data.id,
    playerId: data.player_id,
    playerName: player?.full_name ?? "",
    birthdate: player?.birthdate ?? null,
    // 対象月時点の学年を計算する（レポートは後から見返すものなので「今の学年」ではなく
    // その対象月における学年を表示するのが正確）
    gradeLabel: computeSchoolGrade(player?.birthdate ?? null, data.target_month)?.label ?? null,
    targetMonth: data.target_month,
    status: data.status,
    summaryStats: data.summary_stats as MonthlyReportSummaryStats | null,
    connectText: data.connect_text,
    technicalEvaluation: data.technical_evaluation,
    mentalEvaluation: data.mental_evaluation,
    agreedTheme: data.agreed_theme,
    agreedNotes: data.agreed_notes,
    pdfPath: data.pdf_path,
    publishedAt: data.published_at,
  };
}
