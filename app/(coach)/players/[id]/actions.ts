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
