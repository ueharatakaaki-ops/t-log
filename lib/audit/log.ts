import { createAdminClient } from "@/lib/supabase/server";

/**
 * audit_logs への記録用ヘルパー。センシティブな操作（アカウント発行・紐付け変更等）の
 * 呼び出し元から使う。RLSをバイパスするadminクライアントを使うため、
 * 呼び出し元で必ず requireStaff/requireAdmin 等による権限チェックを済ませておくこと。
 */
export async function logAudit(params: {
  schoolId: string;
  actorId: string;
  action: "view" | "create" | "update" | "delete";
  targetTable: string;
  targetId?: string;
}) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    school_id: params.schoolId,
    actor_id: params.actorId,
    action: params.action,
    target_table: params.targetTable,
    target_id: params.targetId ?? null,
  });
}
