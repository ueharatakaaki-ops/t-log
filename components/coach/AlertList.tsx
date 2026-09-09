import Link from "next/link";
import type { PlayerAlertRow } from "@/lib/queries/coach-dashboard";

const ALERT_STYLE: Record<string, { badge: string; label: string; card: string }> = {
  red: { badge: "bg-rose-500 text-white", label: "要注意", card: "border-rose-200 bg-rose-50" },
  yellow: { badge: "bg-amber-400 text-white", label: "睡眠不足", card: "border-amber-200 bg-amber-50" },
  none: { badge: "bg-emerald-100 text-emerald-700", label: "正常", card: "border-slate-100 bg-white" },
};

export function AlertList({ rows }: { rows: PlayerAlertRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const style = !row.hasSubmittedToday
          ? { badge: "bg-slate-400 text-white", label: "未入力", card: "border-slate-200 bg-[#F4F6F8]" }
          : ALERT_STYLE[row.alertLevel];

        return (
          <Link
            key={row.playerId}
            href={`/players/${row.playerId}`}
            className={`flex items-center justify-between rounded-xl border p-4 transition-colors active:bg-slate-100 ${style.card}`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#0F2537]">{row.fullName}</span>
                {row.category && <span className="text-xs text-slate-400">{row.category}</span>}
              </div>
              {row.hasSubmittedToday ? (
                <p className="mt-1 text-sm text-slate-600">
                  睡眠 {row.sleepHours ?? "-"}h ／ 疲労度 {row.fatigueLevel ?? "-"}
                  {row.hasPain && row.painLocations.length > 0 && (
                    <span className="ml-1 text-rose-600">／ 痛み: {row.painLocations.join("・")}</span>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">本日のDaily Log未入力</p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${style.badge}`}>
              {style.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
