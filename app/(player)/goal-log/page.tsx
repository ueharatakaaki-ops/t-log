import { GoalLogForm } from "@/components/goal-log/GoalLogForm";
import { getGoalLog } from "./actions";
import { defaultGoalLogMonth } from "@/lib/date";
import { monthInputToTargetMonth } from "@/lib/validations/goal-log";

export default async function GoalLogPage() {
  const monthValue = defaultGoalLogMonth();
  const existing = await getGoalLog(monthInputToTargetMonth(monthValue));

  const initial = existing
    ? {
        technicalGoal: existing.technical_goal ?? "",
        physicalGoal: existing.physical_goal ?? "",
        actionPlan: existing.action_plan ?? "",
        coachFeedback: existing.coach_feedback,
      }
    : null;

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">Goal Log</h1>
      <p className="mb-6 text-sm text-slate-500">
        {monthValue} の目標を設定しよう{existing && "（入力済み・修正できます）"}
      </p>
      <GoalLogForm defaultMonthValue={monthValue} initial={initial} />
    </main>
  );
}
