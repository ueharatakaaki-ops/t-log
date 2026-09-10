"use client";

type NumberScaleProps = {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  /** 8以上等、値によって警告色にしたい場合のしきい値 */
  alertThreshold?: number;
};

export function NumberScale({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  lowLabel,
  highLabel,
  alertThreshold,
}: NumberScaleProps) {
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-base font-semibold text-[#0F2537]">{label}</span>
        {value !== null && (
          <span className="text-3xl font-bold text-[#00A859] tabular-nums">{value}</span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2.5">
        {numbers.map((n) => {
          const selected = value === n;
          const isAlert = alertThreshold !== undefined && n >= alertThreshold;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={selected}
              className={[
                "h-16 rounded-xl text-xl font-bold transition-colors",
                selected
                  ? isAlert
                    ? "bg-rose-500 text-white"
                    : "bg-[#0F2537] text-white"
                  : "border border-slate-300 bg-white text-slate-700 active:bg-slate-100",
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}
