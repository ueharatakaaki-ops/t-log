import type { GoalLogEditRecord } from "@/lib/queries/goal-edit-history";

/**
 * 選手が目標本文を書き換えた履歴（修正前の内容）をコーチ向けに表示する。
 * 編集が一度もなければ何も表示しない（大半のケースで履歴は空のはずのため、
 * 通常時に画面が煩雑にならないようにする）。
 */
export function GoalEditHistoryList({ edits }: { edits: GoalLogEditRecord[] }) {
  if (edits.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-800">
        目標が対象月開始前に修正されています（修正前の内容）
      </p>
      {edits.map((e) => (
        <div key={e.id} className="rounded-lg bg-white p-3 text-xs text-slate-600">
          <p className="mb-1 font-semibold text-slate-500">
            {e.targetMonth.slice(0, 7)}分 ／ {new Date(e.editedAt).toLocaleString("ja-JP")} に修正
          </p>
          {e.previousTechnicalGoal && <p>強化テーマ（修正前）: {e.previousTechnicalGoal}</p>}
          {e.previousPhysicalGoal && <p>フィジカル目標（修正前）: {e.previousPhysicalGoal}</p>}
          {e.previousActionPlan && <p>アクションプラン（修正前）: {e.previousActionPlan}</p>}
        </div>
      ))}
    </div>
  );
}
