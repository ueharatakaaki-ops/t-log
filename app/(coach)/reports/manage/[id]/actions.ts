"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/require-staff";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getMonthlyReport } from "@/lib/queries/monthly-report-detail";

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

/**
 * レポートを公開状態にする。
 * 以前はここでPuppeteer(puppeteer-core)によるPDF生成・Storage保存も行っていたが、
 * Vercelのサーバーレス環境でヘッドレスChromiumの起動が安定せず「PDF生成に失敗しました」
 * となるケースが多かった。選手・保護者は元々Web版（/reports/view/[reportId]）だけでも
 * レポート全文を閲覧できるため、PDF生成は撤去し公開処理のみを行う形にシンプル化した。
 */
export async function publishReport(reportId: string): Promise<PublishReportResult> {
  await requireStaff();

  const report = await getMonthlyReport(reportId);
  if (!report) {
    return { ok: false, error: "レポートが見つかりません" };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("monthly_reports")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", reportId);

  if (updateError) {
    return { ok: false, error: "レポートの公開処理に失敗しました" };
  }

  revalidatePath(`/reports/manage/${reportId}`);
  revalidatePath("/reports/manage");
  return { ok: true };
}

