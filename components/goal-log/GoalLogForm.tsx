"use client";

import { useMemo, useState, useTransition } from "react";
import { TextField } from "@/components/shared/TextField";
import { submitGoalLog } from "@/app/(player)/goal-log/actions";
import { goalLogSchema, monthInputToTargetMonth } from "@/lib/validations/goal-log";

type GoalLogFormProps = {
  defaultMonthValue: string; // "YYYY-MM"
  initial?: {
    technicalGoal: string;
    physicalGoal: string;
    actionPlan: string;
    coachFeedback: string | null;
  } | null;
};

export function GoalLogForm({ defaultMonthValue, initial }: GoalLogFormProps) {
  const [monthValue, setMonthValue] = useState(defaultMonthValue);
  const [technicalGoal, setTechnicalGoal] = useState(initial?.technicalGoal ?? "");
  const [physicalGoal, setPhysicalGoal] = useState(initial?.physicalGoal ?? "");
  const [actionPlan, setActionPlan] = useState(initial?.actionPlan ?? "");

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const parsed = useMemo(() => {
    return goalLogSchema.safeParse({
      targetMonth: monthInputToTargetMonth(monthValue),
      technicalGoal,
      physicalGoal,
      actionPlan,
    });
  }, [monthValue, technicalGoal, physicalGoal, actionPlan]);

  const canSubmit = parsed.success && !isPending;

  function handleSubmit() {
    if (!parsed.success) return;
    setSubmitError(null);
    startTransition(async () => {
      const res = await submitGoalLog(parsed.data);
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00A859] text-3xl text-white">
          ✓
        </div>
        <p className="text-lg font-bold text-[#0F2537]">今月の目標を送信しました</p>
        <p className="text-sm text-slate-500">コーチからのフィードバックを待とう。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 pb-28">
      <div>
        <span className="mb-2 block text-base font-semibold text-[#0F2537]">対象月</span>
        <input
          type="month"
          value={monthValue}
          onChange={(e) => setMonthValue(e.target.value)}
          className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-[#0F2537] outline-none focus:border-[#0F2537] focus:ring-2 focus:ring-[#00A859]/20"
        />
      </div>

      <TextField
        label="今期の強化テーマ（技術・戦術の目標）"
        value={technicalGoal}
        onChange={setTechnicalGoal}
        required
        multiline
        maxLength={500}
        placeholder="例: セカンドサーブの安定"
      />
      <TextField
        label="フィジカル・生活の目標"
        value={physicalGoal}
        onChange={setPhysicalGoal}
        required
        multiline
        maxLength={500}
        placeholder="例: 睡眠7時間を毎日キープする"
      />
      <TextField
        label="アクションプラン（達成するための具体的行動）"
        value={actionPlan}
        onChange={setActionPlan}
        required
        multiline
        maxLength={500}
        placeholder="例: 週2回セカンドサーブだけの練習時間を作る"
      />

      {initial?.coachFeedback && (
        <div className="rounded-xl bg-slate-100 p-4">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            コーチからのフィードバック
          </span>
          <p className="text-sm text-slate-800">{initial.coachFeedback}</p>
        </div>
      )}

      {submitError && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{submitError}</p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={[
            "h-14 w-full rounded-xl text-lg font-bold transition-colors",
            canSubmit ? "bg-[#0F2537] text-white active:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-400",
          ].join(" ")}
        >
          {isPending ? "送信中..." : "目標を記録する"}
        </button>
      </div>
    </div>
  );
}
