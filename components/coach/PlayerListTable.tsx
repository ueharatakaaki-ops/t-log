import Link from "next/link";
import type { PlayerListRow } from "@/lib/queries/player-list";

const ALERT_DOT: Record<PlayerListRow["todayAlert"], string> = {
  red: "bg-rose-500",
  yellow: "bg-amber-400",
  none: "bg-emerald-400",
  unsubmitted: "bg-slate-300",
};

export function PlayerListTable({ players }: { players: PlayerListRow[] }) {
  if (players.length === 0) {
    return <p className="text-sm text-slate-500">該当する選手がいません</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
      {players.map((p) => (
        <Link
          key={p.id}
          href={`/players/${p.id}`}
          className="flex items-center justify-between p-4 active:bg-[#F4F6F8]"
        >
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${ALERT_DOT[p.todayAlert]}`} />
            <div>
              <p className="font-semibold text-[#0F2537]">{p.fullName}</p>
              <p className="text-xs text-slate-400">
                {p.category ?? "-"} {p.grade ? `／ ${p.grade}` : ""}
              </p>
            </div>
          </div>
          <span className="text-slate-300">›</span>
        </Link>
      ))}
    </div>
  );
}
