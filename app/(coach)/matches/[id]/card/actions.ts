"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/require-staff";
import { createClient } from "@/lib/supabase/server";

export type UpdateCoachCommentResult = { ok: true } | { ok: false; error: string };

export async function updateMatchCoachComment(
  matchId: string,
  comment: string
): Promise<UpdateCoachCommentResult> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase
    .from("match_logs")
    .update({ coach_comment: comment || null })
    .eq("id", matchId);

  if (error) return { ok: false, error: "保存に失敗しました" };

  revalidatePath(`/matches/${matchId}/card`);
  return { ok: true };
}
