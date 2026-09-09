import type { GoalSummary } from "@/lib/queries/player-detail";

export function GoalSummaryCard({ goal }: { goal: GoalSummary | null }) {
  if (!goal) {
    return <p className="text-sm text-slate-400">Goal Logの登録がまだありません</p>;
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="mb-2 text-xs font-semibold text-slate-400">{goal.targetMonth.slice(0, 7)}</p>
      <Field label="今期の強化テーマ" value={goal.technicalGoal} />
      <Field label="フィジカル・生活の目標" value={goal.physicalGoal} />
      <Field label="アクションプラン" value={goal.actionPlan} />
      {goal.coachFeedback && (
        <div className="mt-3 rounded-lg bg-[#F4F6F8] p-3">
          <p className="mb-1 text-xs font-semibold text-slate-400">コーチからのフィードバック</p>
          <p className="text-sm text-slate-700">{goal.coachFeedback}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}
