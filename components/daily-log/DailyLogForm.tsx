"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NumberScale } from "./NumberScale";
import { SleepChips } from "./SleepChips";
import { PainSection } from "./PainSection";
import { PracticeSection } from "./PracticeSection";
import { NotesSection } from "./NotesSection";
import { dailyLogSchema } from "@/lib/validations/daily-log";
import { pingConnection, resilientPostJson, type ResilientPostOutcome } from "@/lib/client/resilient-post";
import { sendClientLog, type SubmitTrigger } from "@/lib/client/client-log";

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
// 「送信を押したが、成功が確認できていない」印。画面が開いている間に通信が戻ったら自動で再送する
const PENDING_KEY_PREFIX = "t-log:daily-log-pending:";

const GAVE_UP_MESSAGE =
  "送信できませんでした。入力した内容は残っています。電波の良い場所で、もう一度『記録する』を押してください。（画面を再読み込みして『入力済み』になっていれば保存されています）";

type SubmitNotice = { kind: "error"; message: string } | { kind: "auth" } | null;

type DailyLogApiResponse = { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> };

export function DailyLogForm({ logDate, isToday = true, initial }: DailyLogFormProps) {
  const [sleepHours, setSleepHours] = useState<number | null>(initial?.sleepHours ?? null);
  const [fatigueLevel, setFatigueLevel] = useState<number | null>(initial?.fatigueLevel ?? null);
  const [hasPain, setHasPain] = useState<boolean | null>(initial?.hasPain ?? null);
  const [painLocations, setPainLocations] = useState<string[]>(initial?.painLocations ?? []);
  const [hasPractice, setHasPractice] = useState<boolean | null>(initial?.hasPractice ?? null);
  const [practiceIntensity, setPracticeIntensity] = useState<number | null>(initial?.practiceIntensity ?? null);
  const [selfScore, setSelfScore] = useState<number | null>(initial?.selfScore ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const router = useRouter();
  const [sending, setSending] = useState(false);
  // 何回目の試行中か（2回目以降は「再試行しています(2/3)」を出す）
  const [attempt, setAttempt] = useState<{ n: number; total: number } | null>(null);
  const [notice, setNotice] = useState<SubmitNotice>(null);
  const [submitted, setSubmitted] = useState(false);
  // 二重の同時送信を防ぐ（ボタン連打や、自動再送とボタンの重なり）
  const inFlightRef = useRef(false);
  // 送信ごとの通し番号。古い送信の結果が後から届いても画面に反映しないため
  const submitSeqRef = useRef(0);
  // 成功処理を一度だけにするためのフラグ。新しい送信を始めるたびにリセットする
  const successHandledRef = useRef(false);

  const draftKey = `${DRAFT_KEY_PREFIX}${logDate}`;
  const pendingKey = `${PENDING_KEY_PREFIX}${logDate}`;

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

  // online / visibilitychange のイベントから最新の入力内容を参照するため
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  const canSubmit = parsed?.success === true && !sending;

  function setPendingFlag(on: boolean) {
    try {
      if (on) window.localStorage.setItem(pendingKey, "1");
      else window.localStorage.removeItem(pendingKey);
    } catch {
      // ストレージが使えない端末では自動再送しないだけ
    }
  }

  function hasPendingFlag(): boolean {
    try {
      return window.localStorage.getItem(pendingKey) === "1";
    } catch {
      return false;
    }
  }

  function handleSuccess() {
    if (successHandledRef.current) return;
    successHandledRef.current = true;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // 無視してよい
    }
    setPendingFlag(false);
    setNotice(null);
    setSubmitted(true);
    // Server Action と違い、fetch では画面のキャッシュ（入力済み表示など）が自動で更新されないため
    router.refresh();
  }

  // 送信本体。POST /api/daily-log は player_id + log_date の upsert（同一内容の再送も ok）なので、
  // 打ち切り後の再試行で二重に届いても問題ない。再試行の方針は lib/client/resilient-post.ts を参照。
  async function send(trigger: SubmitTrigger) {
    const current = parsedRef.current;
    if (!current || !current.success) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const seq = ++submitSeqRef.current;
    successHandledRef.current = false;
    setPendingFlag(true);
    setSending(true);
    setAttempt(null);
    setNotice(null);

    let outcome: ResilientPostOutcome<DailyLogApiResponse>;
    try {
      outcome = await resilientPostJson<DailyLogApiResponse>("/api/daily-log", current.data, {
        onAttempt: (n, total) => {
          if (seq === submitSeqRef.current) setAttempt({ n, total });
        },
      });
    } catch {
      // resilientPostJson は通常例外を投げないが、念のため送信を諦めた扱いにする
      outcome = { kind: "gave_up", attempts: [] };
    } finally {
      inFlightRef.current = false;
    }

    // 送信の経過を記録する（NEXT_PUBLIC_CLIENT_LOG_ENABLED=1 のときだけ。入力内容は送らない）
    sendClientLog({
      kind: "daily_log",
      outcome: outcome.kind,
      httpStatus: outcome.kind === "gave_up" ? undefined : outcome.status,
      attempts: outcome.attempts,
      trigger,
      logDate,
    });

    if (seq !== submitSeqRef.current) return;
    setSending(false);
    setAttempt(null);

    if (outcome.kind === "ok") {
      handleSuccess();
      return;
    }
    if (outcome.kind === "http_error") {
      if (outcome.status === 401) {
        // 未送信の印は残す（別タブで再ログインして戻ってきたら、自動で再送される）
        setNotice({ kind: "auth" });
        return;
      }
      // 400・403・409 は再送しても結果が変わらないため、自動再送の対象から外す
      setPendingFlag(false);
      setNotice({ kind: "error", message: outcome.data?.error ?? GAVE_UP_MESSAGE });
      return;
    }
    console.error("daily-log submit gave up", outcome.attempts);
    setNotice({ kind: "error", message: GAVE_UP_MESSAGE });
  }

  // 画面を開き直した時点で既に保存済み（initial あり）なら、前回の未送信の印は不要
  useEffect(() => {
    if (initial) setPendingFlag(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 画面が再び見えた・オンラインに戻ったときは、切れた接続を作り直すため軽い疎通確認を送り、
  // 未送信の印があれば自動で1回だけ再送する（送信中なら再送しない）
  useEffect(() => {
    let reconnecting = false;
    async function onReconnect(trigger: SubmitTrigger) {
      if (reconnecting) return;
      reconnecting = true;
      try {
        await pingConnection();
        if (!hasPendingFlag() || inFlightRef.current || successHandledRef.current) return;
        await send(trigger);
      } finally {
        reconnecting = false;
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void onReconnect("visible");
    }
    function onOnline() {
      void onReconnect("online");
    }
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    void send("button");
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

      {notice?.kind === "error" && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">
          {notice.message}
        </p>
      )}
      {notice?.kind === "auth" && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">
          ログインが切れました。再ログインしてください（入力した内容は残っています）。{" "}
          <Link href="/login" className="font-bold underline">
            ログイン画面へ
          </Link>
        </p>
      )}

      {/* 画面下部固定の送信ボタン。1画面完結・スクロールのみで完了させる。
          bottom-16はBottomNav（components/nav/BottomNav.tsx、高さ約4rem）の
          真上に重なるようにするための値。bottom-0のままだとBottomNav（z-10）の
          下に隠れてボタンが押せなくなってしまう。 */}
      <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
        {sending && attempt && attempt.n >= 2 && (
          <p role="status" className="mb-2 text-center text-sm font-medium text-amber-700">
            通信が不安定です。再試行しています({attempt.n}/{attempt.total})
          </p>
        )}
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
          {sending ? "送信中…" : "記録する"}
        </button>
      </div>
    </div>
  );
}
