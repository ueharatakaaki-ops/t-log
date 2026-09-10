import Link from "next/link";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

function formatShort(dateStr: string, today: string): string {
  if (dateStr === today) return "今日";
  // "YYYY-MM-DD" をnew Date(文字列 + "T00:00:00+09:00")経由でパースし、
  // getMonth()/getDate()/getDay()（実行環境のローカルタイムゾーン基準）で
  // 読み出すと、サーバーがUTCで動く環境（Vercelなど）では前日にずれてしまう
  // （JST 00:00は UTCでは前日15:00のため）。実行環境のタイムゾーンに依存しない
  // よう、日付の数値をそのままパースしてUTC基準で組み立てる。
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${m}/${d}(${WEEKDAY[dt.getUTCDay()]})`;
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
