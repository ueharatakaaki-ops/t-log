import Link from "next/link";
import type { MatchSummary } from "@/lib/queries/player-detail";

export function MatchHistoryList({
  matches,
  showShareLink = false,
}: {
  matches: MatchSummary[];
  /** コーチ画面など、SNS共有カードへの導線を出したい場合にtrue */
  showShareLink?: boolean;
}) {
  if (matches.length === 0) {
    return <p className="text-sm text-slate-400">試合記録がまだありません</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {matches.map((m) => (
        <div key={m.id} className="rounded-xl border border-slate-100 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#0F2537]">{m.tournamentName}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                m.result === "win" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {m.result === "win" ? "WIN" : "LOSE"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {m.matchDate} {m.round && `／ ${m.round}`} {m.score && `／ ${m.score}`}
          </p>
          {showShareLink && (
            <Link href={`/matches/${m.id}/card`} className="mt-2 inline-block text-xs font-semibold text-[#00A859]">
              SNS用カードを作る →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
