"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dailyLogSchema, type DailyLogInput } from "@/lib/validations/daily-log";
import { isDailyLogEditable, todayInJst } from "@/lib/date";

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

  const d = parsed.data;

  if (d.logDate > todayInJst()) {
    return { ok: false, error: "未来の日付は記録できません" };
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

  // 「まだ記録がない日」は、書き忘れの救済のため期限を過ぎていてもいつでも入力できる。
  // 一方「既に記録済みの日」を後から書き換えるのは、これまで通り
  // 「対象日の翌日9:00(JST)」までに制限する（コーチが見た後の後出し修正を防ぐため）。
  const { data: existingLog } = await supabase
    .from("daily_logs")
    .select("id")
    .eq("player_id", appUser.id)
    .eq("log_date", d.logDate)
    .maybeSingle();

  if (existingLog && !isDailyLogEditable(d.logDate)) {
    return { ok: false, error: "この日の記録は修正期限（翌日の朝9時）を過ぎているため修正できません" };
  }

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

// 直近の候補日のうち、既に記録がある日を判定するための一覧取得。
// 「未入力の日はいつでも入力できる」ようにするため、日付選択チップ側で
// 「記録済み（修正期限あり）」か「未入力（期限なく入力可）」かを出し分けるのに使う。
export async function getExistingDailyLogDates(dates: string[]): Promise<Set<string>> {
  if (dates.length === 0) return new Set();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Set();

  const { data } = await supabase
    .from("daily_logs")
    .select("log_date")
    .eq("player_id", user.id)
    .in("log_date", dates);

  return new Set((data ?? []).map((row) => row.log_date as string));
}
