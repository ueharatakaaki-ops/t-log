"use client";

import { useState } from "react";
import { DailyTrendChart } from "@/components/coach/DailyTrendChart";
import { MatchHistoryList } from "@/components/coach/MatchHistoryList";
import { GoalSummaryCard } from "@/components/coach/GoalSummaryCard";
import type {
  PlayerProfile,
  DailyTrendPoint,
  MatchSummary,
  GoalSummary,
} from "@/lib/queries/player-detail";

type Detail = {
  profile: PlayerProfile;
  dailyTrend: DailyTrendPoint[];
  matches: MatchSummary[];
  goal: GoalSummary | null;
};

const TABS = [
  { id: "trend", label: "推移グラフ" },
  { id: "daily", label: "日別ログ" },
  { id: "match", label: "試合履歴" },
  { id: "goal", label: "今月の目標" },
] as const;

export function HistoryView({ detail }: { detail: Detail }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("trend");

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
              tab === t.id ? "bg-[#0F2537] text-white" : "border border-slate-300 bg-white text-slate-600",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trend" && (
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <DailyTrendChart points={detail.dailyTrend} />
        </div>
      )}

      {tab === "daily" && (
        <div className="flex flex-col gap-2">
          {detail.dailyTrend.length === 0 && (
            <p className="text-sm text-slate-400">まだ記録がありません</p>
          )}
          {[...detail.dailyTrend]
            .reverse()
            .map((d) => (
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
                {d.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-[#0F2537]">{d.notes}</p>}
                {d.likedByCoach && (
                  <p className="mt-2 text-sm font-semibold text-rose-500">❤️ コーチがいいねしました</p>
                )}
              </div>
            ))}
        </div>
      )}

      {tab === "match" && <MatchHistoryList matches={detail.matches} />}
      {tab === "goal" && <GoalSummaryCard goal={detail.goal} />}
    </div>
  );
}
