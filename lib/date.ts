/** サーバー・クライアント両方から使う、日本時間基準の日付ユーティリティ */

export function todayInJst(): string {
  // Asia/Tokyo の "YYYY-MM-DD" を確実に取得する（サーバーのタイムゾーン設定に依存しない）
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()); // en-CA ロケールは YYYY-MM-DD 形式を返す
}

/** 直近n日分（今日を含む）の日付を新しい順で返す。Daily Logの日付選択に使う */
export function recentJstDates(n: number): string[] {
  const [y, m, d] = todayInJst().split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() - i);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Goal Logのデフォルト対象月（"YYYY-MM"）を計算する。
 * 運用上、月次目標は毎月25日〜月末に「次月分」を入力する想定のため、
 * 25日以降は翌月をデフォルトにする。
 */
export function defaultGoalLogMonth(): string {
  const [y, m, d] = todayInJst().split("-").map(Number);
  const day = d;
  let year = y;
  let month = m;
  if (day >= 25) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * 月次レポートのデフォルト対象月（"YYYY-MM-01"）。
 * レポートは月が締まった後に作成するため、既定では「先月」を対象にする。
 */
export function defaultReportTargetMonth(): string {
  const [y, m] = todayInJst().split("-").map(Number);
  let year = y;
  let month = m - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
