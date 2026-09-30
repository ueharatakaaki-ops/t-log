"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, type AdminContext } from "@/lib/auth/require-admin";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";

const linkSchema = z.object({
  personId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export type LinkActionResult = { ok: true } | { ok: false; error: string };

/**
 * personId（保護者/コーチ）・playerId がどちらも操作者自身の school に
 * 属することを事前に確認する。
 *
 * この画面はUI上はgetLinkManagementData(admin.schoolId)で自校の候補しか
 * 出さないが、サーバーアクション自体はIDを直接POSTすれば呼べてしまうため、
 * RLS（school越境を防ぐ側の本丸。0013マイグレーション参照）に加えて
 * アプリ側でも二重に防ぐ。RLS側の修正漏れ・設定ミスがあっても、
 * 未成年の健康情報（daily_logs等）に直結するparent_player_linksの
 * 越境紐付けだけは確実に止めたいため。
 */
async function assertSameSchool(
  admin: AdminContext,
  table: "parents" | "coaches",
  personId: string,
  playerId: string
): Promise<string | null> {
  const supabaseAdmin = createAdminClient();

  const [{ data: person }, { data: player }] = await Promise.all([
    supabaseAdmin.from(table).select("school_id").eq("id", personId).maybeSingle(),
    supabaseAdmin.from("players").select("school_id").eq("id", playerId).maybeSingle(),
  ]);

  if (!person || person.school_id !== admin.schoolId) return "対象のユーザーが見つかりません";
  if (!player || player.school_id !== admin.schoolId) return "対象の選手が見つかりません";
  return null;
}

export async function addParentLink(personId: string, playerId: string): Promise<LinkActionResult> {
  const parsed = linkSchema.safeParse({ personId, playerId });
  if (!parsed.success) return { ok: false, error: "入力内容を確認してください" };

  const admin = await requireAdmin();

  const schoolError = await assertSameSchool(admin, "parents", parsed.data.personId, parsed.data.playerId);
  if (schoolError) return { ok: false, error: schoolError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("parent_player_links")
    .insert({ parent_id: parsed.data.personId, player_id: parsed.data.playerId });

  if (error) {
    // UNIQUE制約違反（既に紐付け済み）はエラーにせず成功扱いにする
    if (error.code !== "23505") return { ok: false, error: "登録に失敗しました" };
  }

  await logAudit({ schoolId: admin.schoolId, actorId: admin.userId, action: "create", targetTable: "parent_player_links", targetId: parsed.data.playerId });
  revalidatePath("/admin/links");
  return { ok: true };
}

export async function removeParentLink(personId: string, playerId: string): Promise<LinkActionResult> {
  const parsed = linkSchema.safeParse({ personId, playerId });
  if (!parsed.success) return { ok: false, error: "入力内容を確認してください" };

  const admin = await requireAdmin();

  const schoolError = await assertSameSchool(admin, "parents", parsed.data.personId, parsed.data.playerId);
  if (schoolError) return { ok: false, error: schoolError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("parent_player_links")
    .delete()
    .eq("parent_id", parsed.data.personId)
    .eq("player_id", parsed.data.playerId);

  if (error) return { ok: false, error: "解除に失敗しました" };

  await logAudit({ schoolId: admin.schoolId, actorId: admin.userId, action: "delete", targetTable: "parent_player_links", targetId: parsed.data.playerId });
  revalidatePath("/admin/links");
  return { ok: true };
}

export async function addCoachLink(personId: string, playerId: string): Promise<LinkActionResult> {
  const parsed = linkSchema.safeParse({ personId, playerId });
  if (!parsed.success) return { ok: false, error: "入力内容を確認してください" };

  const admin = await requireAdmin();

  const schoolError = await assertSameSchool(admin, "coaches", parsed.data.personId, parsed.data.playerId);
  if (schoolError) return { ok: false, error: schoolError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("coach_player_links")
    .insert({ coach_id: parsed.data.personId, player_id: parsed.data.playerId });

  if (error) {
    if (error.code !== "23505") return { ok: false, error: "登録に失敗しました" };
  }

  await logAudit({ schoolId: admin.schoolId, actorId: admin.userId, action: "create", targetTable: "coach_player_links", targetId: parsed.data.playerId });
  revalidatePath("/admin/links");
  return { ok: true };
}

export async function removeCoachLink(personId: string, playerId: string): Promise<LinkActionResult> {
  const parsed = linkSchema.safeParse({ personId, playerId });
  if (!parsed.success) return { ok: false, error: "入力内容を確認してください" };

  const admin = await requireAdmin();

  const schoolError = await assertSameSchool(admin, "coaches", parsed.data.personId, parsed.data.playerId);
  if (schoolError) return { ok: false, error: schoolError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("coach_player_links")
    .delete()
    .eq("coach_id", parsed.data.personId)
    .eq("player_id", parsed.data.playerId);

  if (error) return { ok: false, error: "解除に失敗しました" };

  await logAudit({ schoolId: admin.schoolId, actorId: admin.userId, action: "delete", targetTable: "coach_player_links", targetId: parsed.data.playerId });
  revalidatePath("/admin/links");
  return { ok: true };
}
