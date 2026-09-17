"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";

const updateStaffRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["coach", "school_admin"]),
  // school_adminのままコーチ業務も兼任させたい場合にtrue。
  // 既にcoachesテーブルに行がある場合は何もしない（既存のコーチメモ等を壊さないため、
  // このUIからcoaches行を削除することは行わない）。
  grantCoachProfile: z.boolean().optional(),
  title: z.string().optional().nullable(),
});

export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;
export type UpdateStaffRoleResult = { ok: true } | { ok: false; error: string };

/**
 * 既存のコーチ／スクール管理者のロールを変更する。
 * 「スクール運用には関与しないので現場の担当者がスクール管理者兼コーチになる」
 * というケース（NLTC・他校ともによくある想定）に対応するための画面から呼ばれる。
 *
 * 選手・保護者・システム管理者のロール変更はこの画面では扱わない
 * （プロフィールテーブルの構造が異なる／権限昇格のリスクがあるため対象外）。
 */
export async function updateStaffRole(input: UpdateStaffRoleInput): Promise<UpdateStaffRoleResult> {
  const parsed = updateStaffRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "入力内容を確認してください" };
  }

  const admin = await requireAdmin();

  // school_adminへの変更は、招待時の権限昇格防止ルールと同様にsystem_adminのみ許可する
  if (parsed.data.role === "school_admin" && admin.role !== "system_admin") {
    return { ok: false, error: "スクール管理者への変更はシステム管理者のみ行えます" };
  }

  if (parsed.data.userId === admin.userId) {
    return { ok: false, error: "自分自身のロールはこの画面からは変更できません" };
  }

  const supabaseAdmin = createAdminClient();

  const { data: target } = await supabaseAdmin
    .from("app_users")
    .select("id, school_id, role")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  if (!target || target.school_id !== admin.schoolId) {
    return { ok: false, error: "対象のユーザーが見つかりません" };
  }

  if (!["coach", "school_admin"].includes(target.role)) {
    return { ok: false, error: "このユーザーの種別（選手・保護者・システム管理者）はこの画面では変更できません" };
  }

  const { error: roleError } = await supabaseAdmin
    .from("app_users")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.userId);

  if (roleError) {
    return { ok: false, error: "ロールの更新に失敗しました" };
  }

  if (parsed.data.grantCoachProfile) {
    // 既にcoaches行がある場合はupsertで実質何もしない（titleだけ更新される）
    const { error: coachError } = await supabaseAdmin.from("coaches").upsert(
      {
        id: parsed.data.userId,
        school_id: admin.schoolId,
        title: parsed.data.title || null,
      },
      { onConflict: "id" }
    );
    if (coachError) {
      return { ok: false, error: "コーチプロフィールの作成に失敗しました" };
    }
  }

  await logAudit({
    schoolId: admin.schoolId,
    actorId: admin.userId,
    action: "update",
    targetTable: "app_users",
    targetId: parsed.data.userId,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}
