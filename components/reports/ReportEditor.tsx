"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/shared/TextField";
import { updateReportContent, publishReport } from "@/app/(coach)/reports/manage/[id]/actions";
import type { MonthlyReportDetail } from "@/lib/queries/monthly-report-detail";

export function ReportEditor({ report }: { report: MonthlyReportDetail }) {
  const router = useRouter();
  const [connectText, setConnectText] = useState(report.connectText ?? "");
  const [technicalEvaluation, setTechnicalEvaluation] = useState(report.technicalEvaluation ?? "");
  const [mentalEvaluation, setMentalEvaluation] = useState(report.mentalEvaluation ?? "");
  const [agreedTheme, setAgreedTheme] = useState(report.agreedTheme ?? "");
  const [agreedNotes, setAgreedNotes] = useState(report.agreedNotes ?? "");

  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const isPublished = report.status === "published";

  function handleSave() {
    setMessage(null);
    startSaving(async () => {
      const res = await updateReportContent({
        reportId: report.id,
        connectText,
        technicalEvaluation,
        mentalEvaluation,
        agreedTheme,
        agreedNotes,
      });
      setMessage(res.ok ? "保存しました" : res.error);
    });
  }

  function handlePublish() {
    setMessage(null);
    startPublishing(async () => {
      const res = await publishReport(report.id);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      // 公開したレポートをそのままWeb版で確認できるよう画面遷移する
      router.push(`/reports/manage/${report.id}/view`);
    });
  }

  const stats = report.summaryStats;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-16">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="入力日数" value={stats?.loggedDays ?? "-"} />
        <StatCard label="試合報告数" value={stats?.matchCount ?? "-"} />
        <StatCard label="平均睡眠(h)" value={stats?.avgSleepHours ?? "-"} />
        <StatCard label="平均疲労度" value={stats?.avgFatigueLevel ?? "-"} />
      </div>

      <fieldset disabled={isPublished} className="flex flex-col gap-6 disabled:opacity-60">
        <TextField
          label="技術・戦術面の評価"
          value={technicalEvaluation}
          onChange={setTechnicalEvaluation}
          multiline
          maxLength={2000}
          placeholder="日誌から抽出したフォーム・打球・戦術等の事実ベースの解説"
        />
        <TextField
          label="メンタル・取り組み姿勢の評価"
          value={mentalEvaluation}
          onChange={setMentalEvaluation}
          multiline
          maxLength={2000}
          placeholder="自律性・言語化能力・モチベーション・姿勢分析"
        />
        <TextField
          label="CONNECT（技術の繋がり・因果関係）"
          value={connectText}
          onChange={setConnectText}
          multiline
          maxLength={2000}
          placeholder="前月テーマが当月の実戦・技術習得にどうつながったか"
        />
        <TextField
          label="今後の技術テーマ"
          value={agreedTheme}
          onChange={setAgreedTheme}
          multiline
          maxLength={1000}
        />
        <TextField
          label="今後の決め事・アドバイス"
          value={agreedNotes}
          onChange={setAgreedNotes}
          multiline
          maxLength={1000}
        />
      </fieldset>

      {message && <p className="text-sm font-medium text-slate-700">{message}</p>}

      {!isPublished ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "下書き保存"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="h-11 flex-1 rounded-xl bg-[#0F2537] text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPublishing ? "公開中..." : "公開する"}
          </button>
        </div>
      ) : (
        <a
          href={`/reports/manage/${report.id}/view`}
          className="block h-11 rounded-xl bg-[#0F2537] text-center text-sm font-semibold leading-[2.75rem] text-white"
        >
          Webで見る
        </a>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
      <p className="text-xl font-bold text-[#00A859]">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
