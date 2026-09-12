import type { PhysicalMeasurementRecord } from "@/lib/queries/player-detail";

const DOMINANT_HAND_LABEL: Record<"right" | "left", string> = {
  right: "右利き",
  left: "左利き",
};

export function PhysicalMeasurementHistoryList({
  measurements,
}: {
  measurements: PhysicalMeasurementRecord[];
}) {
  if (measurements.length === 0) {
    return <p className="text-sm text-slate-400">記録がまだありません</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {measurements.map((m) => (
        <div key={m.id} className="rounded-xl border border-slate-100 bg-white p-3">
          <p className="mb-1 text-sm font-semibold text-[#0F2537]">{m.measuredDate}</p>
          <p className="text-xs text-slate-600">
            {m.heightCm !== null && `身長 ${m.heightCm}cm　`}
            {m.weightKg !== null && `体重 ${m.weightKg}kg　`}
            {(m.eyesightLeft !== null || m.eyesightRight !== null) &&
              `視力 左${m.eyesightLeft ?? "-"}／右${m.eyesightRight ?? "-"}　`}
            {(m.gripStrengthLeft !== null || m.gripStrengthRight !== null) &&
              `握力 左${m.gripStrengthLeft ?? "-"}kg／右${m.gripStrengthRight ?? "-"}kg`}
          </p>
          {(m.dominantHand || m.racket || m.shoes || m.strings) && (
            <p className="mt-1 text-xs text-slate-500">
              {m.dominantHand && `${DOMINANT_HAND_LABEL[m.dominantHand]}　`}
              {m.racket && `ラケット: ${m.racket}　`}
              {m.shoes && `シューズ: ${m.shoes}　`}
              {m.strings && `ガット: ${m.strings}`}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
