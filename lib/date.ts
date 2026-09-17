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

export type SchoolGradeStage = "pre_school" | "elementary" | "junior_high" | "high_school" | "graduated";

export type SchoolGrade = {
  label: string; // 例: "小学6年" "中学2年" "高校3年" "就学前" "卒業"
  stage: SchoolGradeStage;
};

/**
 * 生年月日から日本の学校学年を計算する（4/2〜翌年4/1生まれが同学年、という
 * 日本の学齢区切りに基づく）。手動でU12/U14等のカテゴリーやテキストの学年を
 * 入力・維持するのをやめ、生年月日だけから自動算出するために導入。
 *
 * asOf を省略すると現在時刻（JST）が基準になる。月次レポートなど「その時点での
 * 学年」を出したい場合は、対象月初日などその時点の日付（"YYYY-MM-DD"）を渡す。
 */
export function computeSchoolGrade(birthdate: string | null | undefined, asOf?: string): SchoolGrade | null {
  if (!birthdate) return null;
  const [by, bm, bd] = birthdate.split("-").map(Number);
  if (!by || !bm || !bd) return null;

  const asOfDate = asOf ?? todayInJst();
  const [ay, am] = asOfDate.split("-").map(Number);
  if (!ay || !am) return null;

  // 学齢期の起点: その年の4/2〜翌年4/1生まれが同学年になる（早生まれを繰り上げ扱い）
  const cohortStartYear = bm > 4 || (bm === 4 && bd >= 2) ? by : by - 1;
  const entryYear = cohortStartYear + 7; // 満6歳になる年の4月に小学校入学
  const currentSchoolYear = am >= 4 ? ay : ay - 1; // 学校年度は4月始まり
  const gradeNumber = currentSchoolYear - entryYear + 1;

  if (gradeNumber < 1) return { label: "就学前", stage: "pre_school" };
  if (gradeNumber <= 6) return { label: `小学${gradeNumber}年`, stage: "elementary" };
  if (gradeNumber <= 9) return { label: `中学${gradeNumber - 6}年`, stage: "junior_high" };
  if (gradeNumber <= 12) return { label: `高校${gradeNumber - 9}年`, stage: "high_school" };
  return { label: "卒業", stage: "graduated" };
}
