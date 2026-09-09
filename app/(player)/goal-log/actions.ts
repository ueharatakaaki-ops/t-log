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
