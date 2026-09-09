import Link from "next/link";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

function formatShort(dateStr: string, today: string): string {
  if (dateStr === today) return "今日";
  const d = new Date(dateStr + "T00:00:00+09:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY[d.getDay()]})`;
}

export function DateChips({
  dates,
  selected,
  today,
}: {
  dates: string[];
  selected: string;
  today: string;
}) {
  return (
    <div className="mb-4 flex gap-2.5">
      {dates.map((d) => {
        const isSelected = d === selected;
        return (
          <Link
            key={d}
            href={`/daily-log?date=${d}`}
            className={[
              "h-12 flex-1 rounded-xl text-center text-base font-semibold leading-[3rem]",
              isSelected ? "bg-[#0F2537] text-white" : "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            {formatShort(d, today)}
          </Link>
        );
      })}
    </div>
  );
}
