"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * published状態のレポートに対してのみ、有効期限付きの閲覧URLを発行する。
 * コーチ・選手・保護者いずれの画面からも呼び出す共通関数。
 * アクセス可否はRLS（monthly_reports / storage.objects）に委ねる。
 */
export async function getSignedReportUrl(reportId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("pdf_path, status")
    .eq("id", reportId)
    .maybeSingle();

  if (!report?.pdf_path || report.status !== "published") return null;

  const { data, error } = await supabase.storage
    .from("monthly-reports")
    .createSignedUrl(report.pdf_path, 60 * 10); // 10分間有効

  if (error || !data) return null;
  return data.signedUrl;
}
