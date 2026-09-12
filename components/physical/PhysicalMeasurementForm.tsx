"use client";

import { useMemo, useState, useTransition } from "react";
import { TextField } from "@/components/shared/TextField";
import { SingleChoiceChips } from "@/components/shared/SingleChoiceChips";
import { submitPhysicalMeasurement } from "@/app/(player)/physical/actions";
import {
  physicalMeasurementSchema,
  DOMINANT_HAND_OPTIONS,
} from "@/lib/validations/physical-measurement";

type PhysicalMeasurementFormProps = {
  defaultDate: string; // "YYYY-MM-DD"
  initial: {
    heightCm: string;
    weightKg: string;
    eyesightLeft: string;
    eyesightRight: string;
    gripStrengthLeft: string;
    gripStrengthRight: string;
    dominantHand: "right" | "left" | null;
    racket: string;
    shoes: string;
    strings: string;
  };
};

/** "" はnull、それ以外は数値に変換する。数値以外の文字列が入っている場合はNaNのまま返し、バリデーションで弾く */
function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  return Number(value);
}

export function PhysicalMeasurementForm({ defaultDate, initial }: PhysicalMeasurementFormProps) {
  const [measuredDate, setMeasuredDate] = useState(defaultDate);
  const [heightCm, setHeightCm] = useState(initial.heightCm);
  const [weightKg, setWeightKg] = useState(initial.weightKg);
  const [eyesightLeft, setEyesightLeft] = useState(initial.eyesightLeft);
  const [eyesightRight, setEyesightRight] = useState(initial.eyesightRight);
  const [gripStrengthLeft, setGripStrengthLeft] = useState(initial.gripStrengthLeft);
  const [gripStrengthRight, setGripStrengthRight] = useState(initial.gripStrengthRight);
  const [dominantHand, setDominantHand] = useState<"right" | "left" | null>(initial.dominantHand);
  const [racket, setRacket] = useState(initial.racket);
  const [shoes, setShoes] = useState(initial.shoes);
  const [strings, setStrings] = useState(initial.strings);

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const parsed = useMemo(() => {
    return physicalMeasurementSchema.safeParse({
      measuredDate,
      heightCm: toNumberOrNull(heightCm),
      weightKg: toNumberOrNull(weightKg),
      eyesightLeft: toNumberOrNull(eyesightLeft),
      eyesightRight: toNumberOrNull(eyesightRight),
      gripStrengthLeft: toNumberOrNull(gripStrengthLeft),
      gripStrengthRight: toNumberOrNull(gripStrengthRight),
      dominantHand,
      racket,
      shoes,
      strings,
    });
  }, [
    measuredDate,
    heightCm,
    weightKg,
    eyesightLeft,
    eyesightRight,
    gripStrengthLeft,
    gripStrengthRight,
    dominantHand,
    racket,
    shoes,
    strings,
  ]);

  const canSubmit = parsed.success && !isPending;

  function handleSubmit() {
    if (!parsed.success) return;
    setSubmitError(null);
    startTransition(async () => {
      const res = await submitPhysicalMeasurement(parsed.data);
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00A859] text-3xl text-white">
          ✓
        </div>
        <p className="text-lg font-bold text-[#0F2537]">パーソナルデータを記録しました</p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-2 text-sm font-semibold text-[#0F2537] underline"
        >
          続けて記録する
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 pb-44">
      <div>
        <span className="mb-2 block text-base font-semibold text-[#0F2537]">記録日</span>
        <input
          type="date"
          value={measuredDate}
          onChange={(e) => setMeasuredDate(e.target.value)}
          className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-[#0F2537] outline-none focus:border-[#0F2537] focus:ring-2 focus:ring-[#00A859]/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField label="身長 (cm)" value={heightCm} onChange={setHeightCm} placeholder="例: 165.5" />
        <TextField label="体重 (kg)" value={weightKg} onChange={setWeightKg} placeholder="例: 52.0" />
        <TextField label="視力（左）" value={eyesightLeft} onChange={setEyesightLeft} placeholder="例: 1.0" />
        <TextField label="視力（右）" value={eyesightRight} onChange={setEyesightRight} placeholder="例: 1.2" />
        <TextField
          label="握力（左・kg）"
          value={gripStrengthLeft}
          onChange={setGripStrengthLeft}
          placeholder="例: 25.0"
        />
        <TextField
          label="握力（右・kg）"
          value={gripStrengthRight}
          onChange={setGripStrengthRight}
          placeholder="例: 27.0"
        />
      </div>

      <SingleChoiceChips
        label="利き手"
        options={[...DOMINANT_HAND_OPTIONS]}
        value={dominantHand}
        onChange={(v) => setDominantHand(v as "right" | "left")}
      />

      <TextField label="ラケット" value={racket} onChange={setRacket} placeholder="例: ○○ 100 300g" />
      <TextField label="シューズ" value={shoes} onChange={setShoes} placeholder="例: ○○ 25.5cm" />
      <TextField label="ガット" value={strings} onChange={setStrings} placeholder="例: ○○ 55ポンド" />

      {submitError && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{submitError}</p>
      )}

      <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={[
            "h-14 w-full rounded-xl text-lg font-bold transition-colors",
            canSubmit ? "bg-[#0F2537] text-white active:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-400",
          ].join(" ")}
        >
          {isPending ? "送信中..." : "記録する"}
        </button>
      </div>
    </div>
  );
}
