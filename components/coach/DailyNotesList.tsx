import type { DailyTrendPoint } from "@/lib/queries/player-detail";

/**
 * 選手が日誌（デイリーログ）に書いた「今日の気づき・反省」の自由記述コメントを
 * コーチが確認できるようにする一覧。コンディション推移グラフには数値しか出ないため、
 * コーチ側にコメントを読む場所が無いという不具合報告を受けて追加した。
 * コメントが入力されている日のみ、新しい順で表示する。
 */
export function DailyNotesList({ points }: { points: DailyTrendPoint[] }) {
  const withNotes = [...points].filter((p) => p.notes && p.notes.trim().length > 0).reverse();

  if (withNotes.length === 0) {
    return <p className="text-sm text-slate-400">直近30日でコメントの入力はありません</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {withNotes.map((d) => (
        <div key={d.logDate} className="rounded-xl border border-slate-100 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#0F2537]">{d.logDate}</span>
            {d.hasPain && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                痛み: {d.painLocations.join("・")}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            睡眠 {d.sleepHours ?? "-"}h ／ 疲労度 {d.fatigueLevel ?? "-"} ／ 自己採点 {d.selfScore ?? "-"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#0F2537]">{d.notes}</p>
        </div>
      ))}
    </div>
  );
}
