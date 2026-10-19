// Daily Log の保存処理本体。Server Action（app/(player)/daily-log/actions.ts）と
// Route Handler（app/api/daily-log/route.ts）の両方から呼ぶため、ここに切り出している。
// revalidatePath などの Next.js 固有の後処理は呼び出し側で行う。
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { dailyLogSchema, type DailyLogInput } from "@/lib/validations/daily-log";
import { isDailyLogEditable, todayInJst } from "@/lib/date";

// reason は Route Handler が HTTP ステータスを決めるためのもの
export type SaveDailyLogFailureReason =
  | "validation" // 400
  | "unauthenticated" // 401
  | "forbidden" // 403
  | "deadline" // 409
  | "save_failed"; // 500

export type SaveDailyLogResult =
  | { ok: true }
  | {
      ok: false;
      reason: SaveDailyLogFailureReason;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

type DailyLogRow = {
  sleep_hours: number;
  fatigue_level: number;
  has_pain: boolean;
  pain_locations: string[];
  has_practice: boolean;
  practice_intensity: number | null;
  self_score: number;
  notes: string | null;
  coach_message: string | null;
};

// 既存の保存内容との比較に使う列（upsert で書き込む列のうち、選手の入力に由来するもの）
const COMPARED_COLUMNS =
  "sleep_hours, fatigue_level, has_pain, pain_locations, has_practice, practice_intensity, self_score, notes, coach_message";

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toTextOrNull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

/**
 * 送信内容（DBに書き込む形）と既存の保存内容が、すべて同一かどうか。
 * numeric 列が文字列で返る場合や、空文字/null の違い、痛みの部位の並び順の違いは同一とみなす。
 */
export function isSameDailyLogContent(existing: Record<string, unknown>, row: DailyLogRow): boolean {
  const sortedLocations = (v: unknown) =>
    (Array.isArray(v) ? v.map(String) : []).slice().sort().join("\u0000");

  return (
    toNumberOrNull(existing.sleep_hours) === row.sleep_hours &&
    toNumberOrNull(existing.fatigue_level) === row.fatigue_level &&
    Boolean(existing.has_pain) === row.has_pain &&
    sortedLocations(existing.pain_locations) === sortedLocations(row.pain_locations) &&
    Boolean(existing.has_practice) === row.has_practice &&
    toNumberOrNull(existing.practice_intensity) === row.practice_intensity &&
    toNumberOrNull(existing.self_score) === row.self_score &&
    toTextOrNull(existing.notes) === row.notes &&
    toTextOrNull(existing.coach_message) === row.coach_message
  );
}

export async function saveDailyLog(
  supabase: SupabaseClient<Database>,
  input: unknown,
  options: { now?: Date } = {}
): Promise<SaveDailyLogResult> {
  const parsed = dailyLogSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d: DailyLogInput = parsed.data;

  if (d.logDate > todayInJst()) {
    return { ok: false, reason: "validation", error: "未来の日付は記録できません" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated", error: "ログインが必要です" };
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, school_id, role")
    .eq("id", user.id)
    .single();

  if (appUserError || !appUser || appUser.role !== "player") {
    return { ok: false, reason: "forbidden", error: "選手アカウントでログインしてください" };
  }

  const row: DailyLogRow = {
    sleep_hours: d.sleepHours,
    fatigue_level: d.fatigueLevel,
    has_pain: d.hasPain,
    pain_locations: d.hasPain ? d.painLocations : [],
    has_practice: d.hasPractice,
    practice_intensity: d.hasPractice ? d.practiceIntensity : null,
    self_score: d.selfScore,
    notes: d.notes || null,
    coach_message: d.coachMessage || null,
  };

  // 「まだ記録がない日」は、書き忘れの救済のため期限を過ぎていてもいつでも入力できる。
  // 一方「既に記録済みの日」を後から書き換えるのは、これまで通り
  // 「対象日の翌日9:00(JST)」までに制限する（コーチが見た後の後出し修正を防ぐため）。
  const { data: existingLog, error: existingError } = await supabase
    .from("daily_logs")
    .select(COMPARED_COLUMNS)
    .eq("player_id", appUser.id)
    .eq("log_date", d.logDate)
    .maybeSingle();

  if (existingError) {
    // 既存の有無が分からないまま書き込むと、期限切れの記録を上書きしかねないため保存しない
    // （クライアントは 5xx として自動で再試行する）
    console.error("saveDailyLog existing check failed", existingError.code, existingError.message);
    return { ok: false, reason: "save_failed", error: "保存に失敗しました。時間をおいて再度お試しください" };
  }

  if (existingLog && !isDailyLogEditable(d.logDate, options.now)) {
    // 1回目の保存は成功したが応答だけ失われ、再試行が届いた場合は、保存済みの内容と同一になる。
    // これをエラーにすると「保存済みなのに失敗表示」になるため、同一内容なら成功として扱う（冪等）。
    if (isSameDailyLogContent(existingLog as Record<string, unknown>, row)) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: "deadline",
      error: "この日の記録は修正期限（翌日の朝9時）を過ぎているため修正できません",
    };
  }

  // player_id + log_date のUNIQUE制約を利用し、当日分は upsert（未入力→入力後の修正にも対応）
  const { error } = await supabase.from("daily_logs").upsert(
    {
      player_id: appUser.id,
      school_id: appUser.school_id,
      log_date: d.logDate,
      ...row,
      source: "app",
    },
    { onConflict: "player_id,log_date" }
  );

  if (error) {
    // 原因調査用。個人情報・トークン・player_idは出さず、コードとメッセージのみ
    console.error("saveDailyLog upsert failed", error.code, error.message);
    return { ok: false, reason: "save_failed", error: "保存に失敗しました。時間をおいて再度お試しください" };
  }

  return { ok: true };
}
