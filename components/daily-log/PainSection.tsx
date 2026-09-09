"use client";

import { PAIN_LOCATIONS } from "@/lib/validations/daily-log";

type PainSectionProps = {
  hasPain: boolean | null;
  painLocations: string[];
  onHasPainChange: (value: boolean) => void;
  onLocationsChange: (locations: string[]) => void;
};

export function PainSection({
  hasPain,
  painLocations,
  onHasPainChange,
  onLocationsChange,
}: PainSectionProps) {
  function toggleLocation(loc: string) {
    if (painLocations.includes(loc)) {
      onLocationsChange(painLocations.filter((l) => l !== loc));
    } else {
      onLocationsChange([...painLocations, loc]);
    }
  }

  return (
    <div>
      <span className="mb-2 block text-base font-semibold text-[#0F2537]">
        体に痛み・違和感はありますか？
      </span>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onHasPainChange(false)}
          aria-pressed={hasPain === false}
          className={[
            "h-14 rounded-xl text-lg font-bold transition-colors",
            hasPain === false
              ? "bg-[#00A859] text-white"
              : "bg-slate-100 text-slate-700 active:bg-slate-200",
          ].join(" ")}
        >
          なし
        </button>
        <button
          type="button"
          onClick={() => onHasPainChange(true)}
          aria-pressed={hasPain === true}
          className={[
            "h-14 rounded-xl text-lg font-bold transition-colors",
            hasPain === true
              ? "bg-rose-500 text-white"
              : "bg-slate-100 text-slate-700 active:bg-slate-200",
          ].join(" ")}
        >
          あり
        </button>
      </div>

      {/* 「あり」を選んだ時だけ部位選択を展開表示（入力ステップを減らす） */}
      {hasPain && (
        <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="mb-2 block text-sm font-medium text-slate-600">
            痛む部位を選択してください（複数選択可）
          </span>
          <div className="flex flex-wrap gap-2.5">
            {PAIN_LOCATIONS.map((loc) => {
              const selected = painLocations.includes(loc);
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => toggleLocation(loc)}
                  aria-pressed={selected}
                  className={[
                    "h-12 rounded-full px-5 text-base font-semibold transition-colors",
                    selected
                      ? "bg-rose-500 text-white"
                      : "bg-rose-50 text-rose-700 active:bg-rose-100",
                  ].join(" ")}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
