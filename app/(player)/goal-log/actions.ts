"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { goalLogSchema, type GoalLogInput } from "@/lib/validations/goal-log";

export type SubmitGoalLogResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitGoalLog(input: GoalLogInput): Promise<SubmitGoalLogResult> {
  const parsed = goalLogSchema.safeParse(input);
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

  // player_id + target_month のUNIQUE制約を利用し、同月内の再送信は上書き（修正）として扱う。
  // coach_feedback列はここでは更新しない（コーチ側からのみ編集される想定のため、
  // upsertでも明示的に含めずDB側の既存値を保持する）。
  const { error } = await supabase.from("goal_logs").upsert(
    {
      player_id: appUser.id,
      school_id: appUser.school_id,
      target_month: d.targetMonth,
      technical_goal: d.technicalGoal,
      physical_goal: d.physicalGoal,
      action_plan: d.actionPlan,
      source: "app",
    },
    { onConflict: "player_id,target_month", ignoreDuplicates: false }
  );

  if (error) {
    return { ok: false, error: "保存に失敗しました。時間をおいて再度お試しください" };
  }

  revalidatePath("/goal-log");
  return { ok: true };
}

export async function getGoalLog(targetMonth: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("goal_logs")
    .select("*")
    .eq("player_id", user.id)
    .eq("target_month", targetMonth)
    .maybeSingle();

  return data;
}

/**
 * 目標の進捗％を選手が自分でいつでも更新できるようにするアクション。
 * 目標本文（submitGoalLog）とは別の軽量なアクションにしているのは、進捗はタップした
 * その場で即保存したい一方、目標本文はまとめて送信ボタンを押す運用にしたいため。
 * UPDATE（upsertではない）にしているのは、その月の目標がまだ登録されていない状態で
 * 進捗だけが先に作られてしまう状況を避けるため（目標登録が前提）。
 */
export type UpdateGoalProgressResult = { ok: true } | { ok: false; error: string };

export async function updateGoalProgress(
  targetMonth: string,
  progressPercent: number
): Promise<UpdateGoalProgressResult> {
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    return { ok: false, error: "進捗の値が不正です" };
  }
  if (!/^\d{4}-\d{2}-01$/.test(targetMonth)) {
    return { ok: false, error: "対象月の形式が不正です" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }

  const { error } = await supabase
    .from("goal_logs")
    .update({ progress_percent: progressPercent })
    .eq("player_id", user.id)
    .eq("target_month", targetMonth);

  if (error) {
    return { ok: false, error: "保存に失敗しました。時間をおいて再度お試しください" };
  }

  revalidatePath("/goal-log");
  return { ok: true };
}

/** 選手自身の過去の目標をすべて新しい順で取得する（「過去の目標が消えたように見える」対応のため） */
export async function getGoalLogHistory() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("goal_logs")
    .select("target_month, technical_goal, physical_goal, action_plan, coach_feedback, progress_percent")
    .eq("player_id", user.id)
    .order("target_month", { ascending: false });

  return data ?? [];
}
