"use client";

import { DailyTrendChart } from "@/components/coach/DailyTrendChart";
import { MatchHistoryList } from "@/components/coach/MatchHistoryList";
import type { MonthlyReportSummaryStats } from "@/lib/reports/compute-summary-stats";
import type { MatchSummary } from "@/lib/queries/player-detail";

export type ReportWebViewProps = {
  playerName: string;
  periodLabel: string; // 例: "2026年7月" や "2026-07-01 〜 2026-07-15"
  stats: MonthlyReportSummaryStats;
  matches: MatchSummary[];
  technicalEvaluation?: string | null;
  mentalEvaluation?: string | null;
  connectText?: string | null;
  agreedTheme?: string | null;
  agreedNotes?: string | null;
};

export function ReportWebView({
  playerName,
  periodLabel,
  stats,
  matches,
  technicalEvaluation,
  mentalEvaluation,
  connectText,
  agreedTheme,
  agreedNotes,
}: ReportWebViewProps) {
  const trendPoints = stats.dailySeries.map((d) => ({
    id: d.date,
    logDate: d.date,
    sleepHours: d.sleepHours,
    fatigueLevel: d.fatigueLevel,
    selfScore: null,
    hasPain: false,
    painLocations: [] as string[],
    notes: null,
    likedByCoach: false,
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 print:max-w-full">
      <div className="rounded-2xl bg-[#0F2537] p-5 text-white print:bg-white print:text-[#0F2537] print:border print:border-[#0F2537]">
        <p className="text-xs text-emerald-300 print:text-[#00A859]">NLTC Junior Team</p>
        <h1 className="text-lg font-bold">{playerName} — アスリートレポート</h1>
        <p className="text-sm text-slate-300 print:text-slate-600">{periodLabel}</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="入力日数" value={stats.loggedDays} />
        <StatCard label="試合報告数" value={stats.matchCount} />
        <StatCard label="平均睡眠(h)" value={stats.avgSleepHours ?? "-"} />
        <StatCard label="平均疲労度" value={stats.avgFatigueLevel ?? "-"} />
      </div>

      <Section title="コンディション推移">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm print:shadow-none">
          <DailyTrendChart points={trendPoints} />
        </div>
      </Section>

      {(technicalEvaluation || mentalEvaluation) && (
        <Section title="技術・メンタル評価">
          <div className="grid gap-4 sm:grid-cols-2">
            {technicalEvaluation && (
              <TextCard label="技術・戦術面" text={technicalEvaluation} />
            )}
            {mentalEvaluation && <TextCard label="メンタル・取り組み姿勢" text={mentalEvaluation} />}
          </div>
        </Section>
      )}

      {connectText && (
        <Section title="CONNECT">
          <div className="rounded-xl bg-[#0F2537] p-4 text-sm text-white print:border print:border-[#0F2537] print:bg-white print:text-slate-800">
            <p className="whitespace-pre-wrap">{connectText}</p>
          </div>
        </Section>
      )}

      {(agreedTheme || agreedNotes) && (
        <Section title="合意形成メモ">
          <div className="grid gap-4 sm:grid-cols-2">
            {agreedTheme && <TextCard label="今後の技術テーマ" text={agreedTheme} />}
            {agreedNotes && <TextCard label="今後の決め事・アドバイス" text={agreedNotes} />}
          </div>
        </Section>
      )}

      <Section title="試合履歴">
        <MatchHistoryList matches={matches} />
      </Section>

      <button
        type="button"
        onClick={() => window.print()}
        className="h-11 rounded-xl bg-[#0F2537] text-sm font-semibold text-white print:hidden"
      >
        印刷 / PDFとして保存
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm print:shadow-none">
      <p className="text-xl font-bold text-[#00A859]">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-[#0F2537]">{title}</h2>
      {children}
    </section>
  );
}

function TextCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm print:shadow-none">
      <p className="mb-1 text-xs font-semibold text-slate-400">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-800">{text}</p>
    </div>
  );
}
