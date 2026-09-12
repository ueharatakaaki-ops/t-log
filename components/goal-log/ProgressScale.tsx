"use client";

const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

type ProgressScaleProps = {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/** 目標の進捗％を10%刻みでタップ選択するUI。Daily Logの自己採点(NumberScale)と同じ操作感にしている */
export function ProgressScale({ value, onChange, disabled }: ProgressScaleProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-base font-semibold text-[#0F2537]">達成度</span>
        {value !== null && (
          <span className="text-3xl font-bold text-[#00A859] tabular-nums">{value}%</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {STEPS.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              aria-pressed={selected}
              className={[
                "h-14 rounded-xl text-base font-bold transition-colors",
                disabled
                  ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-300"
                  : selected
                    ? "bg-[#0F2537] text-white"
                    : "border border-slate-300 bg-white text-slate-700 active:bg-slate-100",
              ].join(" ")}
            >
              {n}%
            </button>
          );
        })}
      </div>
    </div>
  );
}
