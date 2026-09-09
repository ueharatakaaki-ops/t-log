"use client";

import { useMemo, useState, useTransition } from "react";
import { SingleChoiceChips } from "@/components/shared/SingleChoiceChips";
import { TextField } from "@/components/shared/TextField";
import { submitMatchLog } from "@/app/(player)/match-log/actions";
import { matchLogSchema, ROUNDS, SURFACES, RESULTS } from "@/lib/validations/match-log";
import { todayInJst } from "@/lib/date";
import type { ScheduleRow } from "@/components/schedule/ScheduleManager";

export function MatchLogForm({ upcomingSchedules = [] }: { upcomingSchedules?: ScheduleRow[] }) {
  const [matchDate, setMatchDate] = useState(todayInJst());
  const [tournamentScheduleId, setTournamentScheduleId] = useState<string>("");
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentGrade, setTournamentGrade] = useState("");
  const [round, setRound] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [opponentClub, setOpponentClub] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [surface, setSurface] = useState<string | null>(null);
  const [goodPoints, setGoodPoints] = useState("");
  const [badNextPoints, setBadNextPoints] = useState("");

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSelectSchedule(id: string) {
    setTournamentScheduleId(id);
    const s = upcomingSchedules.find((x) => x.id === id);
    if (s) {
      setTournamentName(s.tournamentName);
      if (s.surface) setSurface(s.surface);
    }
  }

  const parsed = useMemo(() => {
    if (!round || !result || !surface) return null;
    return matchLogSchema.safeParse({
      matchDate,
      tournamentName,
      tournamentGrade,
      round,
      opponentName,
      opponentClub,
      result,
      score,
      surface,
      goodPoints,
      badNextPoints,
      tournamentScheduleId: tournamentScheduleId || null,
    });
  }, [
    matchDate,
    tournamentScheduleId,
    tournamentName,
    tournamentGrade,
    round,
    opponentName,
    opponentClub,
    result,
    score,
    surface,
    goodPoints,
    badNextPoints,
  ]);

  const canSubmit = parsed?.success === true && !isPending;

  function resetForNextEntry() {
    // 同日に複数試合を報告するケース（練習試合含む）があるため、日付は保持したままリセットする
    setTournamentName("");
    setTournamentGrade("");
    setRound(null);
    setOpponentName("");
    setOpponentClub("");
    setResult(null);
    setScore("");
    setSurface(null);
    setGoodPoints("");
    setBadNextPoints("");
    setSubmitted(false);
  }

  function handleSubmit() {
    if (!parsed || !parsed.success) return;
    setSubmitError(null);
    startTransition(async () => {
      const res = await submitMatchLog(parsed.data);
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00A859] text-3xl text-white">
          ✓
        </div>
        <p className="text-lg font-bold text-[#0F2537]">試合結果を送信しました</p>
        <button
          type="button"
          onClick={resetForNextEntry}
          className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-700 active:bg-slate-200"
        >
          続けて別の試合を登録する
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 pb-28">
      {upcomingSchedules.length > 0 && (
        <div>
          <span className="mb-2 block text-base font-semibold text-[#0F2537]">
            登録済みの大会から選ぶ（任意）
          </span>
          <select
            value={tournamentScheduleId}
            onChange={(e) => handleSelectSchedule(e.target.value)}
            className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-[#0F2537]"
          >
            <option value="">選択しない（自由入力）</option>
            {upcomingSchedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.tournamentName}（{s.startDate}）
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <span className="mb-2 block text-base font-semibold text-[#0F2537]">試合日</span>
        <input
          type="date"
          value={matchDate}
          onChange={(e) => setMatchDate(e.target.value)}
          max={todayInJst()}
          className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-[#0F2537] outline-none focus:border-[#0F2537] focus:ring-2 focus:ring-[#00A859]/20"
        />
      </div>

      <TextField label="大会名" value={tournamentName} onChange={setTournamentName} required placeholder="例: アジアオープン" />
      <TextField
        label="大会グレード・レベル"
        value={tournamentGrade}
        onChange={setTournamentGrade}
        placeholder="例: 国際・国内承認"
      />

      <SingleChoiceChips label="ラウンド（回戦）" options={[...ROUNDS]} value={round} onChange={setRound} />

      <TextField label="対戦相手" value={opponentName} onChange={setOpponentName} placeholder="例: 仲田陸" />
      <TextField label="対戦相手の所属クラブ" value={opponentClub} onChange={setOpponentClub} placeholder="例: 高崎テニスクラブ" />

      <SingleChoiceChips
        label="勝敗"
        options={[...RESULTS]}
        value={result}
        onChange={setResult}
        selectedClassName={result === "lose" ? "bg-rose-500 text-white" : "bg-[#00A859] text-white"}
      />

      <TextField label="スコア" value={score} onChange={setScore} placeholder="例: 4-6, 3-6" />

      <SingleChoiceChips label="コートサーフェス" options={[...SURFACES]} value={surface} onChange={setSurface} />

      <TextField
        label="良かった点（GOOD）"
        value={goodPoints}
        onChange={setGoodPoints}
        required
        multiline
        maxLength={500}
        placeholder="自分のプレーで良かったことを書こう"
      />
      <TextField
        label="悪かった点・次への課題（Bad/Next）"
        value={badNextPoints}
        onChange={setBadNextPoints}
        required
        multiline
        maxLength={500}
        placeholder="次に向けて改善したいことを書こう"
      />

      {submitError && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{submitError}</p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={[
            "h-14 w-full rounded-xl text-lg font-bold transition-colors",
            canSubmit ? "bg-[#0F2537] text-white active:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-400",
          ].join(" ")}
        >
          {isPending ? "送信中..." : "試合結果を記録する"}
        </button>
      </div>
    </div>
  );
}
