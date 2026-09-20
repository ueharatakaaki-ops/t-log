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
  enteredDates,
}: {
  dates: string[];
  selected: string;
  today: string;
  // 指定すると、まだ記録がない日に「未入力」の目印を出す
  // （書き忘れに気づきやすくするため）
  enteredDates?: Set<string>;
}) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {dates.map((d) => {
        const isSelected = d === selected;
        const isMissing = enteredDates ? !enteredDates.has(d) && d !== today : false;
        return (
          <Link
            key={d}
            href={`/daily-log?date=${d}`}
            className={[
              "flex h-14 w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl text-center text-sm font-semibold",
              isSelected ? "bg-[#0F2537] text-white" : "border border-slate-300 bg-white text-slate-600",
            ].join(" ")}
          >
            <span>{formatShort(d, today)}</span>
            {isMissing && (
              <span className={["mt-0.5 text-[10px] font-normal", isSelected ? "text-slate-300" : "text-amber-600"].join(" ")}>
                未入力
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
