"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { matchLogSchema, type MatchLogInput } from "@/lib/validations/match-log";

export type SubmitMatchLogResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitMatchLog(input: MatchLogInput): Promise<SubmitMatchLogResult> {
  const parsed = matchLogSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, school_id, role")
    .eq("id", user.id)
    .single();

  if (appUserError || !appUser || appUser.role !== "player") {
    return { ok: false, error: "選手アカウントでログインしてください" };
  }

  const d = parsed.data;

  // match_logsは1日に複数件あり得る（練習試合を含む）ため、daily_logsと違いupsertではなく
  // 常にinsertする。誤送信の修正は履歴画面からの編集で対応する想定（本フェーズでは新規登録のみ）。
  const { error } = await supabase.from("match_logs").insert({
    player_id: appUser.id,
    school_id: appUser.school_id,
    match_date: d.matchDate,
    tournament_name: d.tournamentName,
    tournament_grade: d.tournamentGrade || null,
    round: d.round,
    opponent_name: d.opponentName || null,
    opponent_club: d.opponentClub || null,
    result: d.result,
    score: d.score || null,
    surface: d.surface,
    good_points: d.goodPoints,
    bad_next_points: d.badNextPoints,
    tournament_schedule_id: d.tournamentScheduleId || null,
    source: "app",
  });

  if (error) {
    return { ok: false, error: "保存に失敗しました。時間をおいて再度お試しください" };
  }

  revalidatePath("/match-log");
  revalidatePath("/history");
  return { ok: true };
}
