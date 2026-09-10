"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/require-staff";
import { generateDraftReportForPlayer, type GenerateDraftReportResult } from "@/lib/reports/generate-draft-report";

export type GenerateDraftResult = GenerateDraftReportResult;

/**
 * コーチ画面からの手動再生成用ラッパー。
 * 実際の集計・保存ロジックは lib/reports/generate-draft-report.ts に共通化されており、
 * 月初に自動実行されるCronジョブ（app/api/cron/generate-monthly-reports）からも同じ関数を呼んでいる。
 */
export async function generateDraftReport(
  playerId: string,
  targetMonth: string
): Promise<GenerateDraftResult> {
  const staff = await requireStaff();
  const result = await generateDraftReportForPlayer(staff.schoolId, playerId, targetMonth);

  revalidatePath("/reports/manage");
  return result;
}
