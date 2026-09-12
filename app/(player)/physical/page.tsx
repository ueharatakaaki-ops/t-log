import { PhysicalMeasurementForm } from "@/components/physical/PhysicalMeasurementForm";
import { PhysicalMeasurementHistoryList } from "@/components/physical/PhysicalMeasurementHistoryList";
import { getMyLatestPhysicalMeasurement, getMyPhysicalMeasurementHistory } from "./actions";
import { todayInJst } from "@/lib/date";

export default async function PhysicalMeasurementPage() {
  const today = todayInJst();
  const [latest, history] = await Promise.all([
    getMyLatestPhysicalMeasurement(),
    getMyPhysicalMeasurementHistory(),
  ]);

  // 用具情報（利き手・ラケット・シューズ・ガット）は毎回入力し直さなくて済むよう、
  // 前回記録した値を初期値として引き継ぐ。身体測定値（身長・体重など）は
  // その日ごとの新しい記録として空欄から入力してもらう。
  const initial = {
    heightCm: "",
    weightKg: "",
    eyesightLeft: "",
    eyesightRight: "",
    gripStrengthLeft: "",
    gripStrengthRight: "",
    dominantHand: latest?.dominantHand ?? null,
    racket: latest?.racket ?? "",
    shoes: latest?.shoes ?? "",
    strings: latest?.strings ?? "",
  };

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">身体データ</h1>
      <p className="mb-6 text-sm text-slate-500">
        身長・体重・視力・握力や、利き手・ラケットなどの用具情報を記録しよう
      </p>
      <PhysicalMeasurementForm key={today} defaultDate={today} initial={initial} />

      {history.length > 0 && (
        <div className="mx-auto mt-10 max-w-md pb-12">
          <h2 className="mb-3 text-sm font-bold text-slate-700">これまでの記録</h2>
          <PhysicalMeasurementHistoryList measurements={history} />
        </div>
      )}
    </main>
  );
}
