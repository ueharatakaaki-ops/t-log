"use client";

type Option = { value: string; label: string };

type SingleChoiceChipsProps = {
  label: string;
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  /** 選択時の色。デフォルトはネイビー。"win"/"lose"のような結果表示で使い分ける */
  selectedClassName?: string;
};

export function SingleChoiceChips({
  label,
  options,
  value,
  onChange,
  selectedClassName = "bg-[#0F2537] text-white",
}: SingleChoiceChipsProps) {
  return (
    <div>
      <span className="mb-2 block text-base font-semibold text-[#0F2537]">{label}</span>
      <div className="flex flex-wrap gap-2.5">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={selected}
              className={[
                "h-14 rounded-full px-5 text-base font-semibold transition-colors",
                selected
                  ? selectedClassName
                  : "border border-slate-300 bg-white text-slate-700 active:bg-slate-100",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
