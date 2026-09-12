import type { GoalSummary } from "@/lib/queries/player-detail";

export function GoalSummaryCard({
  goal,
  history,
}: {
  goal: GoalSummary | null;
  /** 過去の月の目標（最新月を除く、新しい順）。渡された場合のみ「過去の目標」として表示する */
  history?: GoalSummary[];
}) {
  if (!goal) {
    return <p className="text-sm text-slate-400">Goal Logの登録がまだありません</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <GoalCard goal={goal} />

      {history && history.length > 0 && (
        <details className="rounded-xl border border-slate-100 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            過去の目標を見る（{history.length}件）
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {history.map((g) => (
              <GoalCard key={g.targetMonth} goal={g} compact />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** 選手自身のGoal Log画面など、「最新の目標」を別枠ですでに表示していて過去分だけ並べたい場合に使う */
export function PastGoalsList({ goals }: { goals: GoalSummary[] }) {
  if (goals.length === 0) return null;
  return (
    <details className="rounded-xl border border-slate-100 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-600">
        過去の目標を見る（{goals.length}件）
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {goals.map((g) => (
          <GoalCard key={g.targetMonth} goal={g} compact />
        ))}
      </div>
    </details>
  );
}

export function GoalCard({ goal, compact }: { goal: GoalSummary; compact?: boolean }) {
  return (
    <div className={compact ? "border-t border-slate-100 pt-3 first:border-0 first:pt-0" : "rounded-xl border border-slate-100 bg-white p-4"}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">{goal.targetMonth.slice(0, 7)}</p>
        {goal.progressPercent !== null && <ProgressBadge percent={goal.progressPercent} />}
      </div>
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

function ProgressBadge({ percent }: { percent: number }) {
  return (
    <span className="rounded-full bg-[#00A859]/10 px-2.5 py-1 text-xs font-bold text-[#00A859]">
      達成度 {percent}%
    </span>
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
