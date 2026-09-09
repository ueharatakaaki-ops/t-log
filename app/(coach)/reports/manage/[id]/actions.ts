"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/require-staff";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getMonthlyReport } from "@/lib/queries/monthly-report-detail";
import { renderMonthlyReportPdf } from "@/lib/pdf/render-report-pdf";
import type { MatchCardData } from "@/lib/pdf/report-template";

const updateSchema = z.object({
  reportId: z.string().uuid(),
  connectText: z.string().max(2000).optional().default(""),
  technicalEvaluation: z.string().max(2000).optional().default(""),
  mentalEvaluation: z.string().max(2000).optional().default(""),
  agreedTheme: z.string().max(1000).optional().default(""),
  agreedNotes: z.string().max(1000).optional().default(""),
});

export type UpdateReportResult = { ok: true } | { ok: false; error: string };

/** コーチが技術評価・メンタル評価・CONNECT・合意形成メモを入力し、reviewed状態にする */
export async function updateReportContent(
  input: z.infer<typeof updateSchema>
): Promise<UpdateReportResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "入力内容を確認してください" };
  }

  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase
    .from("monthly_reports")
    .update({
      connect_text: parsed.data.connectText || null,
      technical_evaluation: parsed.data.technicalEvaluation || null,
      mental_evaluation: parsed.data.mentalEvaluation || null,
      agreed_theme: parsed.data.agreedTheme || null,
      agreed_notes: parsed.data.agreedNotes || null,
      status: "reviewed",
    })
    .eq("id", parsed.data.reportId)
    .neq("status", "published"); // 公開済みは上書きしない

  if (error) {
    return { ok: false, error: "保存に失敗しました" };
  }

  revalidatePath(`/reports/manage/${parsed.data.reportId}`);
  return { ok: true };
}

export type PublishReportResult = { ok: true } | { ok: false; error: string };

/** PDFを生成し、Storageへ保存したうえでレポートを公開状態にする */
export async function publishReport(reportId: string): Promise<PublishReportResult> {
  const staff = await requireStaff();

  const report = await getMonthlyReport(reportId);
  if (!report) {
    return { ok: false, error: "レポートが見つかりません" };
  }

  const supabase = await createClient();
  const [y, m] = report.targetMonth.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const { data: matchLogs } = await supabase
    .from("match_logs")
    .select("match_date, tournament_name, tournament_grade, surface, result, score, good_points, bad_next_points")
    .eq("player_id", report.playerId)
    .gte("match_date", report.targetMonth)
    .lt("match_date", nextMonth)
    .order("match_date", { ascending: true });

  const matches: MatchCardData[] = (matchLogs ?? []).map((m) => ({
    matchDate: m.match_date,
    tournamentName: m.tournament_name,
    tournamentGrade: m.tournament_grade,
    surface: m.surface,
    result: m.result,
    score: m.score,
    goodPoints: m.good_points,
    badNextPoints: m.bad_next_points,
  }));

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderMonthlyReportPdf(report, matches);
  } catch {
    return { ok: false, error: "PDF生成に失敗しました" };
  }

  const path = `${staff.schoolId}/${report.playerId}/${report.targetMonth}.pdf`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from("monthly-reports")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    return { ok: false, error: "PDFの保存に失敗しました" };
  }

  const { error: updateError } = await admin
    .from("monthly_reports")
    .update({ status: "published", pdf_path: path, published_at: new Date().toISOString() })
    .eq("id", reportId);

  if (updateError) {
    return { ok: false, error: "レポートの公開処理に失敗しました" };
  }

  revalidatePath(`/reports/manage/${reportId}`);
  revalidatePath("/reports/manage");
  return { ok: true };
}

