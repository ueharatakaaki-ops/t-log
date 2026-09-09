"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/require-staff";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { computeMonthlySummaryStats } from "@/lib/reports/compute-summary-stats";

export type GenerateDraftResult = { ok: true; reportId: string } | { ok: false; error: string };

/**
 * 対象月の自動集計値（平均睡眠・平均疲労・入力日数・試合数・痛み履歴など）を計算し、
 * monthly_reports に draft ステータスで保存する。
 * 既に draft/reviewed の場合は summary_stats のみ再計算して上書きする
 * （published 済みのレポートは再現性を保つため上書きしない）。
 */
export async function generateDraftReport(
  playerId: string,
  targetMonth: string
): Promise<GenerateDraftResult> {
  const staff = await requireStaff();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("monthly_reports")
    .select("id, status")
    .eq("player_id", playerId)
    .eq("target_month", targetMonth)
    .maybeSingle();

  if (existing?.status === "published") {
    return { ok: false, error: "公開済みのレポートは自動再生成できません" };
  }

  const stats = await computeMonthlySummaryStats(playerId, targetMonth);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("monthly_reports")
    .upsert(
      {
        player_id: playerId,
        school_id: staff.schoolId,
        target_month: targetMonth,
        status: "draft",
        summary_stats: stats,
      },
      { onConflict: "player_id,target_month" }
    )
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "レポートの生成に失敗しました" };
  }

  revalidatePath("/reports/manage");
  return { ok: true, reportId: data.id };
}
