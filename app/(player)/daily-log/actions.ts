"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dailyLogSchema, type DailyLogInput } from "@/lib/validations/daily-log";
import { isDailyLogEditable } from "@/lib/date";

export type SubmitDailyLogResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitDailyLog(input: DailyLogInput): Promise<SubmitDailyLogResult> {
  const parsed = dailyLogSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // 選手が入力・修正できるのは「対象日の翌日9:00(JST)」まで。
  // それ以降の修正はコーチ・管理者が対応する運用。
  if (!isDailyLogEditable(parsed.data.logDate)) {
    return { ok: false, error: "この日の記録は修正期限（翌日の朝9時）を過ぎているため入力できません" };
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

  // player_id + log_date のUNIQUE制約を利用し、当日分は upsert（未入力→入力後の修正にも対応）
  const { error } = await supabase.from("daily_logs").upsert(
    {
      player_id: appUser.id,
      school_id: appUser.school_id,
      log_date: d.logDate,
      sleep_hours: d.sleepHours,
      fatigue_level: d.fatigueLevel,
      has_pain: d.hasPain,
      pain_locations: d.hasPain ? d.painLocations : [],
      has_practice: d.hasPractice,
      practice_intensity: d.hasPractice ? d.practiceIntensity : null,
      self_score: d.selfScore,
      notes: d.notes || null,
      coach_message: d.coachMessage || null,
      source: "app",
    },
    { onConflict: "player_id,log_date" }
  );

  if (error) {
    return { ok: false, error: "保存に失敗しました。時間をおいて再度お試しください" };
  }

  revalidatePath("/daily-log");
  revalidatePath("/history");
  return { ok: true };
}

// その日すでに入力済みかどうかをホーム画面等から確認するための取得関数
export async function getTodaysDailyLog(logDate: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("player_id", user.id)
    .eq("log_date", logDate)
    .maybeSingle();

  return data;
}
