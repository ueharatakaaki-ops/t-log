"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/require-staff";
import { z } from "zod";

const addNoteSchema = z.object({
  playerId: z.string().uuid(),
  content: z.string().min(1, "内容を入力してください").max(1000),
  visibility: z.enum(["internal", "shared_with_family"]),
});

export type AddCoachNoteResult = { ok: true } | { ok: false; error: string };

export async function addCoachNote(input: {
  playerId: string;
  content: string;
  visibility: "internal" | "shared_with_family";
}): Promise<AddCoachNoteResult> {
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "入力内容を確認してください" };
  }

  const staff = await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase.from("coach_notes").insert({
    player_id: parsed.data.playerId,
    coach_id: staff.userId,
    school_id: staff.schoolId,
    content: parsed.data.content,
    // デフォルトは internal。「shared_with_family」を選ぶ操作は必ずコーチの明示的な選択でのみ行う
    visibility: parsed.data.visibility,
  });

  if (error) {
    return { ok: false, error: "保存に失敗しました" };
  }

  revalidatePath(`/players/${parsed.data.playerId}`);
  return { ok: true };
}

const toggleDailyLogLikeSchema = z.object({
  dailyLogId: z.string().uuid(),
  playerId: z.string().uuid(),
  liked: z.boolean(),
});

export type ToggleDailyLogLikeResult = { ok: true } | { ok: false; error: string };

/** 選手が日誌に書いたコメントに対して、コーチが「いいね」をつけ外しする */
export async function toggleDailyLogLike(input: {
  dailyLogId: string;
  playerId: string;
  liked: boolean;
}): Promise<ToggleDailyLogLikeResult> {
  const parsed = toggleDailyLogLikeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "入力内容を確認してください" };
  }

  const staff = await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase
    .from("daily_logs")
    .update(
      parsed.data.liked
        ? { liked_by_coach_id: staff.userId, liked_by_coach_at: new Date().toISOString() }
        : { liked_by_coach_id: null, liked_by_coach_at: null }
    )
    .eq("id", parsed.data.dailyLogId);

  if (error) {
    return { ok: false, error: "更新に失敗しました" };
  }

  revalidatePath(`/players/${parsed.data.playerId}`);
  return { ok: true };
}
