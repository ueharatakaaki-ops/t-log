"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";

const linkSchema = z.object({
  personId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export type LinkActionResult = { ok: true } | { ok: false; error: string };

export async function addParentLink(personId: string, playerId: string): Promise<LinkActionResult> {
  const parsed = linkSchema.safeParse({ personId, playerId });
  if (!parsed.success) return { ok: false, error: "入力内容を確認してください" };

  const admin = await requireAdmin();
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
