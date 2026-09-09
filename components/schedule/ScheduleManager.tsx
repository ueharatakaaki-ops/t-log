"use client";

import { useState, useTransition } from "react";
import { TextField } from "@/components/shared/TextField";
import { SingleChoiceChips } from "@/components/shared/SingleChoiceChips";
import { addTournamentSchedule, deleteTournamentSchedule } from "@/app/(player)/schedule/actions";
import { SURFACE_OPTIONS } from "@/lib/validations/tournament-schedule";
import { todayInJst } from "@/lib/date";

export type ScheduleRow = {
  id: string;
  tournamentName: string;
  startDate: string;
  endDate: string | null;
  venue: string | null;
  surface: string | null;
};

export function ScheduleManager({ schedules }: { schedules: ScheduleRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [startDate, setStartDate] = useState(todayInJst());
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [surface, setSurface] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const res = await addTournamentSchedule({
        tournamentName,
        startDate,
        endDate: endDate || null,
        venue,
        surface: surface as "omni" | "clay" | "hard" | "indoor" | null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTournamentName("");
      setEndDate("");
      setVenue("");
      setSurface(null);
      setShowForm(false);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTournamentSchedule(id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="h-14 rounded-xl bg-[#0F2537] text-base font-bold text-white"
        >
          + 出場予定の大会を登録
        </button>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <TextField label="大会名" value={tournamentName} onChange={setTournamentName} required placeholder="例: アジアオープン" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-2 block text-sm font-semibold text-[#0F2537]">開始日</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-14 w-full rounded-xl border border-slate-200 px-3 text-base"
              />
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold text-[#0F2537]">終了日（任意）</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-14 w-full rounded-xl border border-slate-200 px-3 text-base"
              />
            </div>
          </div>
          <TextField label="会場" value={venue} onChange={setVenue} placeholder="例: 有明テニスの森" />
          <SingleChoiceChips label="コートサーフェス" options={[...SURFACE_OPTIONS]} value={surface} onChange={setSurface} />

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-12 flex-1 rounded-xl bg-slate-100 text-base font-semibold text-slate-700"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={!tournamentName || !startDate || isPending}
              onClick={handleAdd}
              className="h-12 flex-1 rounded-xl bg-[#0F2537] text-base font-semibold text-white disabled:opacity-50"
            >
              登録する
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {schedules.length === 0 && <p className="text-sm text-slate-400">登録済みの大会はありません</p>}
        {schedules.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <div>
              <p className="font-semibold text-[#0F2537]">{s.tournamentName}</p>
              <p className="text-xs text-slate-500">
                {s.startDate}
                {s.endDate && s.endDate !== s.startDate ? ` 〜 ${s.endDate}` : ""}
                {s.venue && ` ／ ${s.venue}`}
              </p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleDelete(s.id)}
              className="-m-2 p-2 text-sm font-semibold text-rose-600"
            >
              削除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
