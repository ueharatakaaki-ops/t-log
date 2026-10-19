"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { NumberScale } from "./NumberScale";
import { SleepChips } from "./SleepChips";
import { PainSection } from "./PainSection";
import { PracticeSection } from "./PracticeSection";
import { NotesSection } from "./NotesSection";
import { submitDailyLog } from "@/app/(player)/daily-log/actions";
import { dailyLogSchema } from "@/lib/validations/daily-log";

type DailyLogFormProps = {
  logDate: string; // "YYYY-MM-DD"（対象日はサーバー側で固定して渡す。選手が任意の日付を選べる必要はない）
  isToday?: boolean; // 送信完了メッセージの文言出し分け用（未入力日の後日入力にも対応したため）
  initial?: {
    sleepHours: number | null;
    fatigueLevel: number | null;
    hasPain: boolean | null;
    painLocations: string[];
    hasPractice: boolean | null;
    practiceIntensity: number | null;
    selfScore: number | null;
    notes: string;
  } | null;
};

const DRAFT_KEY_PREFIX = "t-log:daily-log-draft:";

// 通信が途中で止まるとServer Actionの返事が戻らず「送信中...」のまま固まるため、
// この時間で見切りをつけてボタンを再び押せるようにする
const SUBMIT_TIMEOUT_MS = 20_000;

export function DailyLogForm({ logDate, isToday = true, initial }: DailyLogFormProps) {
  const [sleepHours, setSleepHours] = useState<number | null>(initial?.sleepHours ?? null);
  const [fatigueLevel, setFatigueLevel] = useState<number | null>(initial?.fatigueLevel ?? null);
  const [hasPain, setHasPain] = useState<boolean | null>(initial?.hasPain ?? null);
  const [painLocations, setPainLocations] = useState<string[]>(initial?.painLocations ?? []);
  const [hasPractice, setHasPractice] = useState<boolean | null>(initial?.hasPractice ?? null);
  const [practiceIntensity, setPracticeIntensity] = useState<number | null>(initial?.practiceIntensity ?? null);
  const [selfScore, setSelfScore] = useState<number | null>(initial?.selfScore ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // タイムアウト後に遅れて届いた成功と、再送の成功が重なっても成功処理を一度だけにするためのフラグ
  const successHandledRef = useRef(false);

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
      setHasPractice(draft.hasPractice ?? null);
      setPracticeIntensity(draft.practiceIntensity ?? null);
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
        JSON.stringify({
          sleepHours,
          fatigueLevel,
          hasPain,
          painLocations,
          hasPractice,
          practiceIntensity,
          selfScore,
          notes,
        })
      );
    } catch {
      // ストレージ容量オーバー等は無視してよい
    }
  }, [
    sleepHours,
    fatigueLevel,
    hasPain,
    painLocations,
    hasPractice,
    practiceIntensity,
    selfScore,
    notes,
    draftKey,
    submitted,
  ]);

  const parsed = useMemo(() => {
    if (
      sleepHours === null ||
      fatigueLevel === null ||
      hasPain === null ||
      hasPractice === null ||
      selfScore === null
    ) {
      return null;
    }
    return dailyLogSchema.safeParse({
      logDate,
      sleepHours,
      fatigueLevel,
      hasPain,
      painLocations,
      hasPractice,
      practiceIntensity,
      selfScore,
      notes,
      coachMessage: "",
    });
  }, [logDate, sleepHours, fatigueLevel, hasPain, painLocations, hasPractice, practiceIntensity, selfScore, notes]);

  const canSubmit = parsed?.success === true && !isPending;

  function handleSuccess() {
    if (successHandledRef.current) return;
    successHandledRef.current = true;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // 無視してよい
    }
    setSubmitError(null);
    setSubmitted(true);
  }

  function handleSubmit() {
    if (!parsed || !parsed.success) return;
    setSubmitError(null);
    startTransition(async () => {
      const request = submitDailyLog(parsed.data);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<"timeout">((resolve) => {
        timeoutId = setTimeout(() => resolve("timeout"), SUBMIT_TIMEOUT_MS);
      });
      let result: Awaited<ReturnType<typeof submitDailyLog>> | "timeout";
      try {
        result = await Promise.race([request, timeout]);
      } catch {
        // 通信断・ログイン切れ等でServer Action自体の呼び出しが失敗した場合。
        // 例外のままだと画面全体がエラー表示に切り替わるため、ここで受け止める
        // （入力内容はlocalStorageの下書きに残っている）
        setSubmitError("送信できませんでした。電波の良い場所で再読み込みしてから、もう一度お試しください");
        return;
      } finally {
        clearTimeout(timeoutId);
      }
      if (result === "timeout") {
        // サーバー側では保存できていても返事だけ届かないことがある。
        // 再送は upsert(player_id, log_date) なので二重登録にはならず安全。
        // 下書きは実際に保存できたか分からないため、ここでは消さない
        console.error("submitDailyLog timed out", { timeoutMs: SUBMIT_TIMEOUT_MS });
        setSubmitError(
          "通信に時間がかかっています。電波の良い場所で、もう一度送信してください。すでに保存されている場合もあるので、画面を再読み込みして『入力済み』になっているかも確認してください"
        );
        // 遅れて成功の返事が届いたら、通常の成功時と同じ処理を行う（失敗・例外は表示済みのエラーのままにする）
        request
          .then((late) => {
            if (late.ok) handleSuccess();
          })
          .catch(() => {});
        return;
      }
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      handleSuccess();
    });
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00A859] text-3xl text-white">
          ✓
        </div>
        <p className="text-lg font-bold text-[#0F2537]">{isToday ? "今日の記録を送信しました" : "この日の記録を送信しました"}</p>
        <p className="text-sm text-slate-500">おつかれさま。また明日も入力しよう。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 pb-44">
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

      <div>
        <PracticeSection
          hasPractice={hasPractice}
          onHasPracticeChange={(v) => {
            setHasPractice(v);
            if (!v) setPracticeIntensity(null);
          }}
        />
        {hasPractice && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <NumberScale
              label="練習のきつさ"
              value={practiceIntensity}
              onChange={setPracticeIntensity}
              lowLabel="1: 楽だった"
              highLabel="10: 限界だった"
            />
          </div>
        )}
      </div>

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

      {/* 画面下部固定の送信ボタン。1画面完結・スクロールのみで完了させる。
          bottom-16はBottomNav（components/nav/BottomNav.tsx、高さ約4rem）の
          真上に重なるようにするための値。bottom-0のままだとBottomNav（z-10）の
          下に隠れてボタンが押せなくなってしまう。 */}
      <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
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
