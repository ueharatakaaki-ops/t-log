"use client";

import { useState, useTransition } from "react";
import { toggleDailyLogLike } from "@/app/(coach)/players/[id]/actions";
import type { DailyTrendPoint } from "@/lib/queries/player-detail";

/**
 * 選手が日誌（デイリーログ）に書いた「今日の気づき・反省」の自由記述コメントを
 * コーチが確認できるようにする一覧。コンディション推移グラフには数値しか出ないため、
 * コーチ側にコメントを読む場所が無いという不具合報告を受けて追加した。
 * コメントが入力されている日のみ、新しい順で表示する。
 * あわせて、コメントに対してコーチが「いいね」をつけられるようにしている
 * （選手・保護者側の履歴画面にも反映される）。
 */
export function DailyNotesList({ playerId, points }: { playerId: string; points: DailyTrendPoint[] }) {
  const withNotes = [...points].filter((p) => p.notes && p.notes.trim().length > 0).reverse();

  if (withNotes.length === 0) {
    return <p className="text-sm text-slate-400">直近30日でコメントの入力はありません</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {withNotes.map((d) => (
        <DailyNoteCard key={d.id} playerId={playerId} point={d} />
      ))}
    </div>
  );
}

function DailyNoteCard({ playerId, point }: { playerId: string; point: DailyTrendPoint }) {
  const [liked, setLiked] = useState(point.likedByCoach);
  const [isPending, startTransition] = useTransition();

  function handleToggleLike() {
    const next = !liked;
    setLiked(next); // 反応の良さを優先し、先に見た目を更新する（失敗時は元に戻す）
    startTransition(async () => {
      const res = await toggleDailyLogLike({ dailyLogId: point.id, playerId, liked: next });
      if (!res.ok) setLiked(!next);
    });
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#0F2537]">{point.logDate}</span>
        {point.hasPain && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
            痛み: {point.painLocations.join("・")}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        睡眠 {point.sleepHours ?? "-"}h ／ 疲労度 {point.fatigueLevel ?? "-"} ／ 自己採点 {point.selfScore ?? "-"}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-[#0F2537]">{point.notes}</p>
      <button
        type="button"
        onClick={handleToggleLike}
        disabled={isPending}
        className={[
          "mt-3 inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold disabled:opacity-60",
          liked ? "bg-rose-100 text-rose-600" : "border border-slate-300 bg-white text-slate-600",
        ].join(" ")}
      >
        {liked ? "❤️ いいね済み" : "🤍 いいね"}
      </button>
    </div>
  );
}
