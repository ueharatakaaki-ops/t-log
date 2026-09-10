"use client";

type SleepChipsProps = {
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function SleepChips({ value, onChange, min = 3, max = 11 }: SleepChipsProps) {
  const options: number[] = [];
  for (let h = min; h <= max; h += 0.5) options.push(h);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-base font-semibold text-[#0F2537]">睡眠時間</span>
        {value !== null && (
          <span className="text-3xl font-bold text-[#00A859] tabular-nums">{value}h</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {options.map((h) => {
          const selected = value === h;
          return (
            <button
              key={h}
              type="button"
              onClick={() => onChange(h)}
              aria-pressed={selected}
              className={[
                "min-w-[4rem] h-14 rounded-full px-3 text-base font-semibold transition-colors",
                selected
                  ? "bg-[#0F2537] text-white"
                  : "border border-slate-300 bg-white text-slate-700 active:bg-slate-100",
              ].join(" ")}
            >
              {h}
            </button>
          );
        })}
      </div>
    </div>
  );
}
