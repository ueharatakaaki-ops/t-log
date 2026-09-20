"use client";

type PracticeSectionProps = {
  hasPractice: boolean | null;
  onHasPracticeChange: (value: boolean) => void;
};

export function PracticeSection({ hasPractice, onHasPracticeChange }: PracticeSectionProps) {
  return (
    <div>
      <span className="mb-2 block text-base font-semibold text-[#0F2537]">
        今日は練習・試合をしましたか？
      </span>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onHasPracticeChange(false)}
          aria-pressed={hasPractice === false}
          className={[
            "h-14 rounded-xl text-lg font-bold transition-colors",
            hasPractice === false
              ? "bg-[#0F2537] text-white"
              : "border border-slate-300 bg-white text-slate-700 active:bg-slate-100",
          ].join(" ")}
        >
          してない
        </button>
        <button
          type="button"
          onClick={() => onHasPracticeChange(true)}
          aria-pressed={hasPractice === true}
          className={[
            "h-14 rounded-xl text-lg font-bold transition-colors",
            hasPractice === true
              ? "bg-[#00A859] text-white"
              : "border border-slate-300 bg-white text-slate-700 active:bg-slate-100",
          ].join(" ")}
        >
          した
        </button>
      </div>
    </div>
  );
}
