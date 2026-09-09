"use client";

import { useState, useTransition } from "react";
import { ReportWebView } from "@/components/reports/ReportWebView";
import { computeCustomReport, type CustomReportResult } from "@/app/(coach)/reports/custom/actions";
import { todayInJst } from "@/lib/date";

export type PlayerOption = { id: string; fullName: string };

export function CustomReportForm({ players }: { players: PlayerOption[] }) {
  const [playerId, setPlayerId] = useState("");
  const [startDate, setStartDate] = useState(() => {
    // デフォルトは直近30日
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(todayInJst());
  const [result, setResult] = useState<CustomReportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    if (!playerId) return;
    setResult(null);
    startTransition(async () => {
      const res = await computeCustomReport(playerId, startDate, endDate);
      setResult(res);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-slate-500">選手</span>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="">選手を選択</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-500">開始日</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-2 text-sm"
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-500">終了日</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            max={todayInJst()}
            className="h-11 rounded-lg border border-slate-200 px-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={!playerId || isPending}
          onClick={handleGenerate}
          className="h-11 rounded-lg bg-[#0F2537] px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "集計中..." : "集計する"}
        </button>
      </div>

      {result && !result.ok && <p className="text-sm text-rose-600">{result.error}</p>}

      {result && result.ok && (
        <ReportWebView
          playerName={result.playerName}
          periodLabel={`${startDate} 〜 ${endDate}`}
          stats={result.stats}
          matches={result.matches}
        />
      )}
    </div>
  );
}
