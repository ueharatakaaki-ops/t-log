import type { MatchCardDetail } from "@/lib/queries/match-detail";

const SURFACE_LABEL: Record<string, string> = {
  omni: "オムニ",
  clay: "クレー",
  hard: "ハード",
  indoor: "インドア",
};

/**
 * Instagram投稿を想定した正方形（1:1）の試合結果カード。
 * ブラウザの「右クリック→画像として保存」やスクリーンショットでの利用を想定。
 */
export function MatchShareCard({ match }: { match: MatchCardDetail }) {
  return (
    <div className="aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-[#0F2537] p-8 text-white shadow-lg">
      <div className="flex h-full flex-col justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#00A859]">NLTC JUNIOR TEAM</p>
          <p className="mt-1 text-2xl font-bold">{match.playerName}</p>
        </div>

        <div className="flex items-center gap-4">
          <span
            className={`rounded-full px-4 py-1 text-lg font-black ${
              match.result === "win" ? "bg-[#00A859]" : "bg-rose-500"
            }`}
          >
            {match.result === "win" ? "WIN" : match.result === "lose" ? "LOSE" : "-"}
          </span>
          {match.score && <span className="text-2xl font-bold">{match.score}</span>}
        </div>

        <div>
          <p className="text-lg font-bold">{match.tournamentName}</p>
          <p className="text-sm text-slate-300">
            {match.matchDate}
            {match.round && ` ／ ${match.round}`}
            {match.surface && ` ／ ${SURFACE_LABEL[match.surface] ?? match.surface}`}
          </p>
        </div>

        {match.goodPoints && (
          <div>
            <p className="text-xs font-semibold text-[#00A859]">GOOD</p>
            <p className="line-clamp-2 text-sm">{match.goodPoints}</p>
          </div>
        )}

        {match.badNextPoints && (
          <div>
            <p className="text-xs font-semibold text-slate-300">NEXT</p>
            <p className="line-clamp-2 text-sm">{match.badNextPoints}</p>
          </div>
        )}

        {match.coachComment && (
          <div className="rounded-xl bg-white/10 p-3">
            <p className="mb-1 text-xs font-semibold text-[#00A859]">COACH COMMENT</p>
            <p className="line-clamp-3 text-sm">{match.coachComment}</p>
          </div>
        )}
      </div>
    </div>
  );
}
