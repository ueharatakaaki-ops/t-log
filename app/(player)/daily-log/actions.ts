"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DailyLogInput } from "@/lib/validations/daily-log";
import { saveDailyLog } from "@/lib/daily-log/save";

export type SubmitDailyLogResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// 現在の画面は POST /api/daily-log（app/api/daily-log/route.ts）で送信する。
// この Server Action は、デプロイ前から開かれたままの古い画面が呼び出すため残している（削除しないこと）。
// 保存処理の本体は lib/daily-log/save.ts にある。
export async function submitDailyLog(input: DailyLogInput): Promise<SubmitDailyLogResult> {
  const supabase = await createClient();
  const result = await saveDailyLog(supabase, input);

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
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

  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("player_id", user.id)
    .eq("log_date", logDate)
    .maybeSingle();

  if (error) console.error("getTodaysDailyLog failed", error.code, error.message);

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

  const { data, error } = await supabase
    .from("daily_logs")
    .select("log_date")
    .eq("player_id", user.id)
    .in("log_date", dates);

  if (error) console.error("getExistingDailyLogDates failed", error.code, error.message);

  return new Set((data ?? []).map((row) => row.log_date as string));
}
