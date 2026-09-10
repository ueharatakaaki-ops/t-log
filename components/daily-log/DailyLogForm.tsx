"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { NumberScale } from "./NumberScale";
import { SleepChips } from "./SleepChips";
import { PainSection } from "./PainSection";
import { NotesSection } from "./NotesSection";
import { submitDailyLog } from "@/app/(player)/daily-log/actions";
import { dailyLogSchema } from "@/lib/validations/daily-log";

type DailyLogFormProps = {
  logDate: string; // "YYYY-MM-DD"（対象日はサーバー側で固定して渡す。選手が任意の日付を選べる必要はない）
  initial?: {
    sleepHours: number | null;
    fatigueLevel: number | null;
    hasPain: boolean | null;
    painLocations: string[];
    selfScore: number | null;
    notes: string;
  } | null;
};

const DRAFT_KEY_PREFIX = "t-log:daily-log-draft:";

export function DailyLogForm({ logDate, initial }: DailyLogFormProps) {
  const [sleepHours, setSleepHours] = useState<number | null>(initial?.sleepHours ?? null);
  const [fatigueLevel, setFatigueLevel] = useState<number | null>(initial?.fatigueLevel ?? null);
  const [hasPain, setHasPain] = useState<boolean | null>(initial?.hasPain ?? null);
  const [painLocations, setPainLocations] = useState<string[]>(initial?.painLocations ?? []);
  const [selfScore, setSelfScore] = useState<number | null>(initial?.selfScore ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const draftKey = `${DRAFT_KEY_PREFIX}${logDate}`;

  // 電波が悪い環境向けに、未送信の入力内容を端末に一時保存しておく
  useEffect(() => {
    if (initial) return; // 既存データがある場合は下書き復元しない
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setSleepHours(draft.sleepHours ?? null);
      setFatigueLevel(draft.fatigueLevel ?? null);
      setHasPain(draft.hasPain ?? null);
      setPainLocations(draft.painLocations ?? []);
      setSelfScore(draft.selfScore ?? null);
      setNotes(draft.notes ?? "");
    } catch {
      // 下書き復元の失敗は致命的ではないため無視
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (submitted) return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ sleepHours, fatigueLevel, hasPain, painLocations, selfScore, notes })
      );
    } catch {
      // ストレージ容量オーバー等は無視してよい
    }
  }, [sleepHours, fatigueLevel, hasPain, painLocations, selfScore, notes, draftKey, submitted]);

  const parsed = useMemo(() => {
    if (sleepHours === null || fatigueLevel === null || hasPain === null || selfScore === null) {
      return null;
    }
    return dailyLogSchema.safeParse({
      logDate,
      sleepHours,
      fatigueLevel,
      hasPain,
      painLocations,
      selfScore,
      notes,
      coachMessage: "",
    });
  }, [logDate, sleepHours, fatigueLevel, hasPain, painLocations, selfScore, notes]);

  const canSubmit = parsed?.success === true && !isPending;

  function handleSubmit() {
    if (!parsed || !parsed.success) return;
    setSubmitError(null);
    startTransition(async () => {
      const result = await submitDailyLog(parsed.data);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // 無視してよい
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00A859] text-3xl text-white">
          ✓
        </div>
        <p className="text-lg font-bold text-[#0F2537]">今日の記録を送信しました</p>
        <p className="text-sm text-slate-500">おつかれさま。また明日も入力しよう。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 pb-28">
      <SleepChips value={sleepHours} onChange={setSleepHours} />

      <NumberScale
        label="今日の疲労度"
        value={fatigueLevel}
        onChange={setFatigueLevel}
        lowLabel="1: 絶好調"
        highLabel="10: クタクタ・動けない"
        alertThreshold={8}
      />

      <PainSection
        hasPain={hasPain}
        painLocations={painLocations}
        onHasPainChange={(v) => {
          setHasPain(v);
          if (!v) setPainLocations([]);
        }}
        onLocationsChange={setPainLocations}
      />

      <NumberScale
        label="今日の自己採点"
        value={selfScore}
        onChange={setSelfScore}
        lowLabel="1: 不満"
        highLabel="10: やりきった"
      />

      <NotesSection notes={notes} onNotesChange={setNotes} />

      {submitError && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">
          {submitError}
        </p>
      )}

      {/* 画面下部固定の送信ボタン。1画面完結・スクロールのみで完了させる */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={[
            "h-14 w-full rounded-xl text-lg font-bold transition-colors",
            canSubmit
              ? "bg-[#0F2537] text-white active:bg-slate-800"
              : "cursor-not-allowed bg-slate-200 text-slate-400",
          ].join(" ")}
        >
          {isPending ? "送信中..." : "記録する"}
        </button>
      </div>
    </div>
  );
}
