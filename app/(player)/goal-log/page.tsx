import { GoalLogForm } from "@/components/goal-log/GoalLogForm";
import { PastGoalsList } from "@/components/coach/GoalSummaryCard";
import { getGoalLog, getGoalLogHistory } from "./actions";
import { defaultGoalLogMonth } from "@/lib/date";
import { monthInputToTargetMonth } from "@/lib/validations/goal-log";
import type { GoalSummary } from "@/lib/queries/player-detail";

export default async function GoalLogPage() {
  const monthValue = defaultGoalLogMonth();
  const targetMonth = monthInputToTargetMonth(monthValue);
  const [existing, historyRows] = await Promise.all([getGoalLog(targetMonth), getGoalLogHistory()]);

  const initial = existing
    ? {
        technicalGoal: existing.technical_goal ?? "",
        physicalGoal: existing.physical_goal ?? "",
        actionPlan: existing.action_plan ?? "",
        coachFeedback: existing.coach_feedback,
        progressPercent: existing.progress_percent,
      }
    : null;

  // 表示中の対象月（今月）を「過去の目標」一覧からは除く
  const history: GoalSummary[] = historyRows
    .filter((g) => g.target_month !== targetMonth)
    .map((g) => ({
      targetMonth: g.target_month,
      technicalGoal: g.technical_goal,
      physicalGoal: g.physical_goal,
      actionPlan: g.action_plan,
      coachFeedback: g.coach_feedback,
      progressPercent: g.progress_percent,
    }));

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">Goal Log</h1>
      <p className="mb-6 text-sm text-slate-500">
        {monthValue} の目標を設定しよう{existing && "（入力済み・修正できます）"}
      </p>
      <GoalLogForm defaultMonthValue={monthValue} initial={initial} />

      <div className="mx-auto mt-8 max-w-md pb-52">
        <PastGoalsList goals={history} />
      </div>
    </main>
  );
}
