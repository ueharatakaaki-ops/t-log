import { createClient } from "@/lib/supabase/server";

export type GoalLogEditRecord = {
  id: string;
  targetMonth: string;
  previousTechnicalGoal: string | null;
  previousPhysicalGoal: string | null;
  previousActionPlan: string | null;
  editedAt: string;
};

/**
 * 選手が目標本文（技術・フィジカル・アクションプラン）を書き換えた履歴を、
 * 新しい順に取得する。RLS（goal_log_edits_select）により、コーチ・スクール管理者
 * または選手本人からのみ取得できる。コーチの選手個別ページから利用する想定。
 */
export async function getGoalEditHistory(playerId: string): Promise<GoalLogEditRecord[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("goal_log_edits")
    .select("id, target_month, previous_technical_goal, previous_physical_goal, previous_action_plan, edited_at")
    .eq("player_id", playerId)
    .order("edited_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((r) => ({
    id: r.id,
    targetMonth: r.target_month,
    previousTechnicalGoal: r.previous_technical_goal,
    previousPhysicalGoal: r.previous_physical_goal,
    previousActionPlan: r.previous_action_plan,
    editedAt: r.edited_at,
  }));
}
