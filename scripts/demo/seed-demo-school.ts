/**
 * 営業デモ・動作確認用の「t-logデモスクール」（slug: demo）を作成する。
 * NLTC（slug: nltc）を含む他のスクールのデータには一切書き込まない。
 *
 * 使い方:
 *   npm run demo:seed            … ドライラン（接続先と作成内容を表示するだけで、何も書き込まない）
 *   npm run demo:seed -- --yes   … 実際に作成する
 * 後片付け: npm run demo:cleanup -- --yes
 *
 * 冪等: スクール・アカウントは既存のものを再利用する。記録データ（Daily Log等）は
 * 実行日（日本時間）基準で作り直すため、デモスクール内の既存の記録を削除してから作成する。
 *
 * パスワードはコンソールに出さず、リポジトリ外の CREDENTIALS_PATH にのみ保存する。
 * 月次レポートの評価文はAIを呼ばずに固定文を入れる（費用をかけないため）。
 * PDFはアプリ側でPDF生成を撤去済み（Web表示のみ）のため作成しない。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  adminClient,
  assertDemoSchool,
  countDemoSchool,
  countNltc,
  CREDENTIALS_PATH,
  DEMO_ACCOUNTS,
  DEMO_SCHOOL,
  deleteDemoRecords,
  findAuthUsersByEmail,
  findDemoSchool,
  isConfirmed,
  loadSavedPasswords,
  supabaseHost,
  type DemoAccountKey,
} from "./common";
import { computeSchoolGrade, todayInJst } from "../../lib/date";
import type { MonthlyReportSummaryStats } from "../../lib/reports/compute-summary-stats";

const progress: string[] = [];
function done(step: string) {
  progress.push(step);
  console.log(`  ✔ ${step}`);
}

// ------------------------------------------------------------
// 日付ユーティリティ（すべて日本時間の今日を基準にする）
// ------------------------------------------------------------
const TODAY = todayInJst();

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  return addDays(TODAY, -n);
}
function monthStart(date: string, offsetMonths = 0): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offsetMonths, 1)).toISOString().slice(0, 10);
}
function dayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=日
}
/** JSTの指定日・時刻を ISO 文字列（UTC）にする */
function jstTimestamp(date: string, hour: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 9)).toISOString();
}

const THIS_MONTH = monthStart(TODAY);
const LAST_MONTH = monthStart(TODAY, -1);

/** Daily Log は先月1日から今日までの日数分を作る（公開済みサンプルの先月分レポートに丸1か月分が入るように） */
function daysBetween(from: string, to: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}
const DAILY_LOG_DAYS = daysBetween(LAST_MONTH, TODAY) + 1; // 今日を含む

/** 指定した学年（小1=1 … 中2=8）になる生年月日を、今年度基準で計算する */
function birthdateForGrade(gradeNumber: number, monthDay: string): string {
  const [y, m] = TODAY.split("-").map(Number);
  const schoolYear = m >= 4 ? y : y - 1;
  const cohortStartYear = schoolYear - gradeNumber - 6; // lib/date.ts computeSchoolGrade の逆算
  return `${cohortStartYear}-${monthDay}`;
}

// ------------------------------------------------------------
// 再現性のある乱数（毎回同じ傾向のデータにするため）
// ------------------------------------------------------------
function makeRandom(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
  };
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ------------------------------------------------------------
// 選手プロフィール・ダミーデータの定義
// ------------------------------------------------------------
type PlayerKey = "taro" | "hanako";

const PLAYER_PROFILES: Record<PlayerKey, { gradeNumber: number; gradeText: string; category: string; birthMonthDay: string; expectedGradeLabel: string }> = {
  taro: { gradeNumber: 8, gradeText: "中2", category: "U14", birthMonthDay: "06-15", expectedGradeLabel: "中学2年" },
  hanako: { gradeNumber: 6, gradeText: "小6", category: "U12", birthMonthDay: "09-03", expectedGradeLabel: "小学6年" },
};

/** 必ずアラート（疲労8以上 or 痛みあり）にする日。0=今日 */
const ALERT_DAYS: Record<PlayerKey, { daysAgo: number; fatigue?: number; pain?: string[] }[]> = {
  taro: [
    { daysAgo: 0, fatigue: 8, pain: ["肘"] }, // 今日 → コーチのダッシュボードでRED表示
    { daysAgo: 9, fatigue: 9 },
    { daysAgo: 15, pain: ["手首"] },
    { daysAgo: 16, pain: ["手首"] },
  ],
  hanako: [
    { daysAgo: 5, fatigue: 8 },
    { daysAgo: 12, pain: ["膝"] },
  ],
};

const NOTES = [
  "サーブが良かった",
  "切り替えが早くできた",
  "footworkを意識できた",
  "ミスが多かった",
  "集中が続かなかった",
  "体が重かった",
  "バックハンドのクロスが安定してきた",
  "フォアの打点を前にする意識で打てた",
  "ラリー練習で最後まで足が動いた",
  "",
  "",
];

function buildDailyLogs(key: PlayerKey, playerId: string, schoolId: string, coachId: string, matchDates: Set<string>) {
  const rand = makeRandom(key === "taro" ? 1401 : 1206);
  const isTaro = key === "taro";
  const alerts = new Map(ALERT_DAYS[key].map((a) => [a.daysAgo, a]));
  const rows = [];

  for (let i = 0; i < DAILY_LOG_DAYS; i++) {
    const date = daysAgo(i);
    // 花子は今日の分を未入力にしておく（コーチ画面の「未入力」表示・選手側での入力デモ用）
    if (!isTaro && i === 0) continue;
    // 数日は入力漏れがある、という現実的な状態にする（アラート日は除く）
    if (!alerts.has(i) && rand.next() < 0.1) continue;

    const dow = dayOfWeek(date);
    const isMatchDay = matchDates.has(date);
    const restDay = isTaro ? dow === 1 : [1, 3, 5].includes(dow);
    const hasPractice = isMatchDay || !restDay;
    const intensity = hasPractice ? (isMatchDay ? rand.int(8, 9) : rand.int(isTaro ? 5 : 4, isTaro ? 8 : 7)) : null;

    const sleepBase = isTaro ? rand.int(13, 16) / 2 : rand.int(16, 19) / 2; // 太郎 6.5〜8.0h / 花子 8.0〜9.5h
    const sleepHours = rand.next() < 0.08 ? 5.5 : sleepBase; // たまに睡眠不足（YELLOW相当）
    let fatigue = clamp(Math.round((intensity ?? 2) * 0.6 + rand.int(0, 3)), 1, 7);
    let painLocations: string[] = [];

    const alert = alerts.get(i);
    if (alert?.fatigue) fatigue = alert.fatigue;
    if (alert?.pain) painLocations = alert.pain;

    rows.push({
      player_id: playerId,
      school_id: schoolId,
      log_date: date,
      sleep_hours: sleepHours,
      fatigue_level: fatigue,
      has_pain: painLocations.length > 0,
      pain_locations: painLocations,
      has_practice: hasPractice,
      practice_intensity: intensity,
      self_score: clamp(rand.int(5, 8) - (painLocations.length > 0 ? 2 : 0), 1, 10),
      notes: alert?.pain ? `${alert.pain.join("・")}に少し違和感があった` : rand.pick(NOTES),
      coach_message: i === 0 && isTaro ? "肘に少し痛みがあります。明日のサーブ練習の量を相談したいです。" : null,
      // 何件かはコーチが「いいね」済みにしておく
      ...(i > 0 && i % 4 === 1 ? { liked_by_coach_id: coachId, liked_by_coach_at: jstTimestamp(date, 22) } : {}),
      source: "app",
    });
  }
  return rows;
}

const MATCHES: Record<PlayerKey, { daysAgo: number; tournament: string; grade: string; round: string; opponent: string; result: "win" | "lose"; score: string; surface: "omni" | "clay" | "hard" | "indoor"; good: string; bad: string; coachComment?: string }[]> = {
  taro: [
    { daysAgo: 6, tournament: "デモカップ ジュニアテニス大会", grade: "U14", round: "本戦 1R", opponent: "相手選手A", result: "win", score: "6-3", surface: "omni", good: "ファーストサーブの確率が高く、主導権を取れた", bad: "リードしてからのリターンが浅くなった", coachComment: "サーブからの組み立てが良くなっています。" },
    { daysAgo: 6, tournament: "デモカップ ジュニアテニス大会", grade: "U14", round: "本戦 2R", opponent: "相手選手B", result: "lose", score: "4-6", surface: "omni", good: "粘り強くラリーを続けられた", bad: "ネットに出るタイミングが遅かった" },
    { daysAgo: 20, tournament: "デモオープン", grade: "U14", round: "予選 1R", opponent: "相手選手C", result: "win", score: "6-1", surface: "hard", good: "バックハンドのクロスでポイントが取れた", bad: "セカンドサーブが甘くなる場面があった" },
    { daysAgo: 20, tournament: "デモオープン", grade: "U14", round: "予選 2R", opponent: "相手選手D", result: "win", score: "7-5", surface: "hard", good: "競った場面でも攻める判断ができた", bad: "序盤の入りが硬かった", coachComment: "5-5からの2ゲームは見事でした。" },
    { daysAgo: 21, tournament: "デモオープン", grade: "U14", round: "本戦 1R", opponent: "相手選手E", result: "lose", score: "3-6", surface: "hard", good: "最後まで集中を切らさなかった", bad: "高い打点のボールへの対応" },
    { daysAgo: 41, tournament: "デモ地区ジュニア選手権", grade: "U14", round: "本戦 1R", opponent: "相手選手F", result: "win", score: "6-4", surface: "clay", good: "フットワークが良く、守備から攻撃に切り替えられた", bad: "ドロップショットの精度" },
  ],
  hanako: [
    { daysAgo: 7, tournament: "デモカップ ジュニアテニス大会", grade: "U12", round: "本戦 1R", opponent: "相手選手G", result: "win", score: "6-2", surface: "omni", good: "フォアハンドを深く打てた", bad: "サーブのトスが安定しない", coachComment: "深いボールで相手を下げられていました。" },
    { daysAgo: 7, tournament: "デモカップ ジュニアテニス大会", grade: "U12", round: "本戦 2R", opponent: "相手選手H", result: "lose", score: "2-6", surface: "omni", good: "最後まで声を出して戦えた", bad: "相手のスピンボールに押された" },
    { daysAgo: 27, tournament: "デモ市ジュニア大会", grade: "U12", round: "順位別トーナメント 1R", opponent: "相手選手I", result: "win", score: "6-4", surface: "hard", good: "ミスを引きずらずに切り替えられた", bad: "バックハンドが短くなる" },
    { daysAgo: 34, tournament: "練習試合", grade: "", round: "練習試合", opponent: "相手選手J", result: "lose", score: "4-6", surface: "omni", good: "新しく練習したスライスを試せた", bad: "ラリーが長くなるとミスが出る" },
    { daysAgo: 48, tournament: "デモ地区ジュニア選手権", grade: "U12", round: "予選 1R", opponent: "相手選手K", result: "win", score: "6-3", surface: "clay", good: "ネットプレーでポイントを取れた", bad: "ファーストサーブの確率" },
  ],
};

const GOALS: Record<PlayerKey, Record<"last" | "this", { technical: string; physical: string; action: string; progress: number; feedback: string | null }>> = {
  taro: {
    last: { technical: "ファーストサーブの確率を60%以上にする", physical: "体幹トレーニングを週4回続ける", action: "練習の最初に必ずサーブを50本打つ", progress: 80, feedback: "確率は上がってきています。次はコースの打ち分けも意識しましょう。" },
    this: { technical: "セカンドサーブでもスピンをかけて深く入れる", physical: "肘に負担をかけないよう、練習後のストレッチを毎日行う", action: "練習日誌に毎回サーブの手応えを書く", progress: 40, feedback: null },
  },
  hanako: {
    last: { technical: "バックハンドを深く返す", physical: "縄跳びを毎日3分続ける", action: "ラリー練習でベースライン付近を狙う", progress: 60, feedback: "深さが出てきました。高い打点からも打てるようにしていきましょう。" },
    this: { technical: "サーブのトスを安定させる", physical: "練習前のウォーミングアップを丁寧に行う", action: "家でトスの練習を10回×3セット", progress: 30, feedback: null },
  },
};

const NOTES_BY_COACH: Record<PlayerKey, { daysAgo: number; visibility: "internal" | "shared_with_family"; content: string }[]> = {
  taro: [
    { daysAgo: 2, visibility: "internal", content: "肘の違和感を本人が気にしている。サーブ練習の本数を1週間ほど減らして様子を見る。" },
    { daysAgo: 8, visibility: "shared_with_family", content: "大会では競った場面でも積極的に攻められていました。ご家庭でも睡眠時間の確保をお願いします。" },
    { daysAgo: 22, visibility: "internal", content: "手首の痛みは2日で解消。グリップの握り方を確認済み。" },
  ],
  hanako: [
    { daysAgo: 3, visibility: "internal", content: "スピンボールへの対応が課題。来週から高い打点の練習メニューを追加する。" },
    { daysAgo: 9, visibility: "shared_with_family", content: "試合で最後まで声を出して頑張っていました。サーブのトスを家でも少し練習してみてください。" },
  ],
};

const SCHEDULES: Record<PlayerKey, { inDays: number; length: number; name: string; venue: string; surface: "omni" | "clay" | "hard" | "indoor" }[]> = {
  taro: [
    { inDays: 12, length: 2, name: "デモオープン 秋季大会", venue: "デモテニスパーク（架空）", surface: "hard" },
    { inDays: 33, length: 3, name: "デモ地区ジュニア選手権 冬季", venue: "架空市営テニスコート", surface: "omni" },
  ],
  hanako: [
    { inDays: 12, length: 1, name: "デモカップ U12", venue: "デモテニスパーク（架空）", surface: "omni" },
    { inDays: 26, length: 2, name: "デモ市ジュニア大会", venue: "架空市営テニスコート", surface: "hard" },
  ],
};

const MEASUREMENTS: Record<PlayerKey, { monthsAgo: number; height: number; weight: number; eyeL: number; eyeR: number; gripL: number; gripR: number }[]> = {
  taro: [
    { monthsAgo: 4, height: 157.8, weight: 45.6, eyeL: 1.2, eyeR: 1.0, gripL: 27.5, gripR: 31.0 },
    { monthsAgo: 0, height: 160.1, weight: 47.2, eyeL: 1.2, eyeR: 1.0, gripL: 29.0, gripR: 33.5 },
  ],
  hanako: [
    { monthsAgo: 4, height: 144.6, weight: 35.1, eyeL: 1.5, eyeR: 1.5, gripL: 18.5, gripR: 20.0 },
    { monthsAgo: 0, height: 146.9, weight: 36.4, eyeL: 1.5, eyeR: 1.2, gripL: 19.5, gripR: 21.5 },
  ],
};

const EQUIPMENT: Record<PlayerKey, { hand: "right" | "left"; racket: string; shoes: string; strings: string }> = {
  taro: { hand: "right", racket: "デモラケット 100（ダミー）", shoes: "デモシューズ オムニ用（ダミー）", strings: "デモガット 1.25mm（ダミー）" },
  hanako: { hand: "left", racket: "デモラケット 25インチ（ダミー）", shoes: "デモシューズ ジュニア（ダミー）", strings: "デモガット 1.30mm（ダミー）" },
};

/** 月次レポートの評価文（AIは呼ばず、自然な固定文を入れる） */
const REPORT_TEXT: Record<PlayerKey, Record<"published" | "draft", { technical: string; mental: string; connect: string; theme: string | null; notes: string | null }>> = {
  taro: {
    published: {
      technical: "ファーストサーブの確率が上がり、サーブから主導権を握れる場面が増えました。試合ではバックハンドのクロスでポイントを取る形が定着しつつあります。一方で、高い打点のボールへの対応や、リードした後のリターンが浅くなる点は引き続きの課題です。",
      mental: "競った場面でも自分から攻める判断ができるようになってきました。負けた試合の後も日誌で課題を具体的に振り返れており、取り組み姿勢はとても前向きです。",
      connect: "練習強度が高い週の翌日は疲労度が上がる傾向が見られました。強度の高い練習が続く週は、睡眠時間を7時間半以上確保できると、翌日のコンディションが安定しやすいと考えられます。",
      theme: "セカンドサーブの質を上げ、サービスゲームを安定させる",
      notes: "サーブ練習は1日の本数を決めて、肘・手首に違和感があれば必ず日誌に書く。練習後のストレッチを毎日行う。",
    },
    draft: {
      technical: "大会ではサーブからの組み立てが良く、初戦を安定して勝ち上がりました。2回戦ではネットに出るタイミングが遅れ、相手に主導権を渡す場面が見られました。",
      mental: "肘の違和感を自分からコーチに伝えられたのは大切な成長です。体の変化に気づき、早めに相談する習慣を続けていきましょう。",
      connect: "今月は疲労度8以上の日と痛みの記録が重なっており、試合週の練習量が多かった可能性があります。来週以降の練習量の調整を検討します。",
      theme: null,
      notes: null,
    },
  },
  hanako: {
    published: {
      technical: "フォアハンドを深く打てるようになり、相手を後ろに下げてから攻める形ができてきました。バックハンドが短くなる場面と、サーブのトスの安定が次の課題です。",
      mental: "ミスをしても引きずらずに切り替えられるようになりました。試合中も声を出して最後まで戦う姿勢が素晴らしいです。",
      connect: "睡眠時間が安定して確保できている週は自己採点も高く、練習の集中も続いています。今の生活リズムを続けることが、試合での安定感につながっていると考えられます。",
      theme: "サーブのトスを安定させ、ダブルフォルトを減らす",
      notes: "家でトスの練習を毎日10回×3セット。試合前はルーティンを決めてからサーブに入る。",
    },
    draft: {
      technical: "大会ではフォアハンドの深いボールで初戦を勝ち上がりました。2回戦では相手のスピンボールに押される場面が多く、高い打点からの返球が課題として見えました。",
      mental: "負けた試合の後も日誌で前向きに振り返れています。膝の違和感があった日もきちんと記録できていました。",
      connect: "膝に違和感があった時期の前後は練習強度がやや高めでした。成長期でもあるため、痛みが続く場合は練習量を調整して様子を見ます。",
      theme: null,
      notes: null,
    },
  },
};

// ------------------------------------------------------------
// 月次レポートの集計（lib/reports/compute-summary-stats.ts の computeStatsForRange と同じ計算）
// lib側は Next.js 用のクライアント（next/headers）に依存しておりCLIから呼べないため、
// 同じクエリ・同じ計算をここで行う。形は MonthlyReportSummaryStats 型で揃えている。
// ------------------------------------------------------------
async function computeStatsForRange(playerId: string, startDate: string, endDateExclusive: string): Promise<MonthlyReportSummaryStats> {
  const { data: dailyLogs, error: e1 } = await adminClient
    .from("daily_logs")
    .select("log_date, sleep_hours, fatigue_level, self_score, has_pain, pain_locations, has_practice, practice_intensity")
    .eq("player_id", playerId)
    .gte("log_date", startDate)
    .lt("log_date", endDateExclusive)
    .order("log_date", { ascending: true });
  const { data: matchLogs, error: e2 } = await adminClient
    .from("match_logs")
    .select("good_points, bad_next_points")
    .eq("player_id", playerId)
    .gte("match_date", startDate)
    .lt("match_date", endDateExclusive);
  if (e1 || e2) throw new Error(`集計用データの取得に失敗: ${e1?.message ?? e2?.message}`);

  const logs = dailyLogs ?? [];
  const matches = matchLogs ?? [];
  const avg = (nums: number[]) =>
    nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

  // PostgRESTは numeric 型を数値で返すが、念のため Number に揃える
  const sleepValues = logs.map((l) => l.sleep_hours).filter((v): v is number => v !== null).map(Number);
  const fatigueValues = logs.map((l) => l.fatigue_level).filter((v): v is number => v !== null);
  const selfScoreValues = logs.map((l) => l.self_score).filter((v): v is number => v !== null);
  const practiceIntensityValues = logs
    .filter((l) => l.has_practice)
    .map((l) => l.practice_intensity)
    .filter((v): v is number => v !== null);

  return {
    loggedDays: logs.length,
    matchCount: matches.length,
    avgSleepHours: avg(sleepValues),
    avgFatigueLevel: avg(fatigueValues),
    avgSelfScore: avg(selfScoreValues),
    practiceDays: logs.filter((l) => l.has_practice).length,
    avgPracticeIntensity: avg(practiceIntensityValues),
    painDays: logs.filter((l) => l.has_pain).map((l) => ({ date: l.log_date, locations: l.pain_locations ?? [] })),
    dailySeries: logs.map((l) => ({
      date: l.log_date,
      sleepHours: l.sleep_hours,
      fatigueLevel: l.fatigue_level,
      hasPractice: l.has_practice,
      practiceIntensity: l.practice_intensity,
    })),
    goodBadTrend: {
      good: matches.map((m) => m.good_points).filter((v): v is string => !!v),
      bad: matches.map((m) => m.bad_next_points).filter((v): v is string => !!v),
    },
  };
}

// ------------------------------------------------------------
// アカウント・パスワード
// ------------------------------------------------------------
function generatePassword(): string {
  // 24文字のURLセーフなランダム文字列（144bit）
  return crypto.randomBytes(18).toString("base64url");
}

function assertOutsideRepo(filePath: string) {
  const rel = path.relative(process.cwd(), filePath);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
    throw new Error("安全のため中断: 認証情報ファイルの保存先がリポジトリ配下になっています");
  }
}

function writeCredentials(passwords: Record<DemoAccountKey, string>, loginUrlHint: string) {
  assertOutsideRepo(CREDENTIALS_PATH);
  const lines = [
    "# t-log デモスクール（slug: demo）ログイン情報",
    "# このファイルは npm run demo:seed が自動生成します。リポジトリに入れたり、外部に共有しないでください。",
    `# 接続先: ${loginUrlHint}`,
    `# 更新日時: ${new Date().toISOString()}`,
    "",
  ];
  for (const key of Object.keys(DEMO_ACCOUNTS) as DemoAccountKey[]) {
    const a = DEMO_ACCOUNTS[key];
    lines.push(`${a.displayName}（${a.role}）`, `  email: ${a.email}`, `  password: ${passwords[key]}`, "");
  }
  fs.writeFileSync(CREDENTIALS_PATH, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
}

async function ensureAccount(
  key: DemoAccountKey,
  schoolId: string,
  existingAuthId: string | undefined,
  password: string
): Promise<string> {
  const account = DEMO_ACCOUNTS[key];
  let userId = existingAuthId;

  if (userId) {
    // 既存ユーザーが他校（NLTC等）に所属していないことを必ず確認してから触る
    const { data: appUser } = await adminClient.from("app_users").select("school_id").eq("id", userId).maybeSingle();
    if (appUser && appUser.school_id !== schoolId) {
      throw new Error(`安全のため中断: ${account.email} は既にデモ以外のスクールに所属しています`);
    }
    const { error } = await adminClient.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) throw new Error(`${account.email} のパスワード設定に失敗: ${error.message}`);
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true, // 招待メールは送らない
      user_metadata: { display_name: account.displayName },
    });
    if (error || !data.user) throw new Error(`${account.email} の作成に失敗: ${error?.message}`);
    userId = data.user.id;
  }

  const { error: appUserError } = await adminClient
    .from("app_users")
    .upsert({ id: userId, school_id: schoolId, role: account.role, display_name: account.displayName }, { onConflict: "id" });
  if (appUserError) {
    if (!existingAuthId) await adminClient.auth.admin.deleteUser(userId); // 認証ユーザーだけ残る不整合を防ぐ
    throw new Error(`app_users の作成に失敗(${account.email}): ${appUserError.message}`);
  }

  if (account.role === "player") {
    const profile = PLAYER_PROFILES[key as PlayerKey];
    const { error } = await adminClient.from("players").upsert(
      {
        id: userId,
        school_id: schoolId,
        full_name: account.displayName,
        birthdate: birthdateForGrade(profile.gradeNumber, profile.birthMonthDay),
        grade: profile.gradeText,
        category: profile.category,
        joined_at: monthStart(TODAY, -18),
        status: "active",
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`players の作成に失敗(${account.email}): ${error.message}`);
  } else if (account.role === "coach") {
    const { error } = await adminClient
      .from("coaches")
      .upsert({ id: userId, school_id: schoolId, title: "ヘッドコーチ" }, { onConflict: "id" });
    if (error) throw new Error(`coaches の作成に失敗(${account.email}): ${error.message}`);
  } else if (account.role === "parent") {
    const { error } = await adminClient.from("parents").upsert({ id: userId, school_id: schoolId }, { onConflict: "id" });
    if (error) throw new Error(`parents の作成に失敗(${account.email}): ${error.message}`);
  }

  return userId;
}

async function insertRows(table: string, rows: object[]) {
  if (rows.length === 0) return;
  const { error } = await adminClient.from(table).insert(rows);
  if (error) throw new Error(`${table} の作成に失敗: ${error.message}`);
  done(`${table}: ${rows.length} 件`);
}

// ------------------------------------------------------------
// メイン
// ------------------------------------------------------------
function printPlan() {
  console.log("");
  console.log("これから作成・更新する内容:");
  console.log(`  スクール: ${DEMO_SCHOOL.name}（slug: ${DEMO_SCHOOL.slug} / plan: ${DEMO_SCHOOL.plan}）※既にあれば再利用`);
  console.log("  アカウント（既にあれば再利用。パスワードは画面に出さずファイルに保存）:");
  for (const a of Object.values(DEMO_ACCOUNTS)) console.log(`    - ${a.displayName}（${a.role}）${a.email}`);
  console.log("  紐付け: デモ 保護者 ⇔ デモ 太郎、デモ コーチ ⇔ デモ 太郎・デモ 花子");
  console.log(`  基準日（日本時間の今日）: ${TODAY} / 先月: ${LAST_MONTH.slice(0, 7)} / 今月: ${THIS_MONTH.slice(0, 7)}`);
  console.log(`  daily_logs: 両選手の ${LAST_MONTH} 〜 ${TODAY}（${DAILY_LOG_DAYS}日分。入力漏れ・アラート日を含む。花子は今日を未入力）`);
  console.log(`  match_logs: 太郎 ${MATCHES.taro.length} 件 / 花子 ${MATCHES.hanako.length} 件（直近約2か月）`);
  console.log("  goal_logs: 両選手の今月・先月");
  console.log("  coach_notes: internal / shared_with_family の両方");
  console.log("  physical_measurements: 各選手2件 / tournament_schedules: 各選手2件（今後の大会）");
  console.log("  monthly_reports: 先月分=published（固定文）、今月分=draft（AIは呼ばない。PDFなし）");
  console.log("  ※ 再実行時は、デモスクール内の記録データを削除してから作り直します（ユーザーは再利用）");
  console.log(`  認証情報の保存先: ${CREDENTIALS_PATH}`);
}

async function dryRunChecks() {
  const school = await findDemoSchool();
  console.log("");
  console.log("現在の状態（読み取りのみ）:");
  console.log(`  デモスクール: ${school ? `既にあり（${school.name} / plan: ${school.plan}）` : "なし（新規作成）"}`);
  const existing = await findAuthUsersByEmail(Object.values(DEMO_ACCOUNTS).map((a) => a.email));
  for (const a of Object.values(DEMO_ACCOUNTS)) {
    const id = existing.get(a.email.toLowerCase());
    if (!id) {
      console.log(`  ${a.email}: なし（新規作成）`);
      continue;
    }
    const { data: appUser } = await adminClient.from("app_users").select("school_id").eq("id", id).maybeSingle();
    const conflict = appUser && (!school || appUser.school_id !== school.id);
    console.log(`  ${a.email}: 既にあり${conflict ? " ⚠️ デモ以外のスクールに所属（実行時は中断します）" : "（再利用）"}`);
  }
  if (school) {
    console.log("  デモスクール内の現在の件数:", await countDemoSchool(school.id));
  }
  console.log("  NLTCの現在の件数（比較用）:", await countNltc());
}

async function main() {
  console.log(`接続先: ${supabaseHost()}`);
  printPlan();

  // 生年月日の計算が意図した学年になっているかを先に確認する
  for (const key of ["taro", "hanako"] as const) {
    const p = PLAYER_PROFILES[key];
    const label = computeSchoolGrade(birthdateForGrade(p.gradeNumber, p.birthMonthDay))?.label;
    if (label !== p.expectedGradeLabel) throw new Error(`生年月日の計算が不正です（${key}: ${label}）`);
  }

  if (!isConfirmed()) {
    await dryRunChecks();
    console.log("");
    console.log("ドライランのため、何も書き込まずに終了しました。実行するには: npm run demo:seed -- --yes");
    return;
  }

  console.log("");
  console.log("作成を開始します...");
  const nltcBefore = await countNltc();

  // 1. スクール
  let school = await findDemoSchool();
  if (!school) {
    const { data, error } = await adminClient
      .from("schools")
      .insert({ name: DEMO_SCHOOL.name, slug: DEMO_SCHOOL.slug, plan: DEMO_SCHOOL.plan })
      .select("id, name, slug, plan")
      .single();
    if (error || !data) throw new Error(`デモスクールの作成に失敗: ${error?.message}`);
    school = data;
    done("デモスクールを作成");
  } else {
    done("既存のデモスクールを再利用");
  }
  assertDemoSchool(school);
  const schoolId = school.id;

  // 2. アカウント
  const saved = loadSavedPasswords();
  const existingAuth = await findAuthUsersByEmail(Object.values(DEMO_ACCOUNTS).map((a) => a.email));
  const accountKeys = Object.keys(DEMO_ACCOUNTS) as DemoAccountKey[];
  const passwords = Object.fromEntries(
    accountKeys.map((key) => [key, saved.get(DEMO_ACCOUNTS[key].email.toLowerCase()) ?? generatePassword()])
  ) as Record<DemoAccountKey, string>;
  const ids = {} as Record<DemoAccountKey, string>;
  for (const key of accountKeys) {
    const email = DEMO_ACCOUNTS[key].email.toLowerCase();
    ids[key] = await ensureAccount(key, schoolId, existingAuth.get(email), passwords[key]);
    // アカウントを作るたびに保存しておく（途中で失敗してもログイン情報が失われないように）
    writeCredentials(passwords, supabaseHost());
    done(`アカウント: ${DEMO_ACCOUNTS[key].displayName}`);
  }
  done(`認証情報を保存: ${CREDENTIALS_PATH}`);

  // 3. 既存の記録データを削除（日付を実行日基準で作り直すため。デモスクール内のみ）
  await deleteDemoRecords(schoolId);
  done("デモスクール内の既存の記録データを削除");

  // 4. 紐付け
  await insertRows("parent_player_links", [{ parent_id: ids.parent, player_id: ids.taro }]);
  await insertRows("coach_player_links", [
    { coach_id: ids.coach, player_id: ids.taro },
    { coach_id: ids.coach, player_id: ids.hanako },
  ]);

  const players: { key: PlayerKey; id: string }[] = [
    { key: "taro", id: ids.taro },
    { key: "hanako", id: ids.hanako },
  ];

  // 5. 記録データ
  await insertRows(
    "tournament_schedules",
    players.flatMap(({ key, id }) =>
      SCHEDULES[key].map((s) => ({
        player_id: id,
        school_id: schoolId,
        tournament_name: s.name,
        start_date: addDays(TODAY, s.inDays),
        end_date: s.length > 1 ? addDays(TODAY, s.inDays + s.length - 1) : null,
        venue: s.venue,
        surface: s.surface,
      }))
    )
  );

  await insertRows(
    "match_logs",
    players.flatMap(({ key, id }) =>
      MATCHES[key].map((m) => ({
        player_id: id,
        school_id: schoolId,
        match_date: daysAgo(m.daysAgo),
        tournament_name: m.tournament,
        tournament_grade: m.grade || null,
        round: m.round,
        opponent_name: m.opponent,
        opponent_club: "架空テニスクラブ",
        result: m.result,
        score: m.score,
        surface: m.surface,
        good_points: m.good,
        bad_next_points: m.bad,
        coach_comment: m.coachComment ?? null,
        source: "app",
      }))
    )
  );

  await insertRows(
    "daily_logs",
    players.flatMap(({ key, id }) =>
      buildDailyLogs(key, id, schoolId, ids.coach, new Set(MATCHES[key].map((m) => daysAgo(m.daysAgo))))
    )
  );

  await insertRows(
    "goal_logs",
    players.flatMap(({ key, id }) =>
      (["last", "this"] as const).map((which) => {
        const g = GOALS[key][which];
        return {
          player_id: id,
          school_id: schoolId,
          target_month: which === "last" ? LAST_MONTH : THIS_MONTH,
          technical_goal: g.technical,
          physical_goal: g.physical,
          action_plan: g.action,
          progress_percent: g.progress,
          coach_feedback: g.feedback,
          source: "app",
        };
      })
    )
  );

  await insertRows(
    "coach_notes",
    players.flatMap(({ key, id }) =>
      NOTES_BY_COACH[key].map((n) => ({
        player_id: id,
        coach_id: ids.coach,
        school_id: schoolId,
        content: n.content,
        visibility: n.visibility,
        created_at: jstTimestamp(daysAgo(n.daysAgo), 19),
      }))
    )
  );

  await insertRows(
    "physical_measurements",
    players.flatMap(({ key, id }) =>
      MEASUREMENTS[key].map((m) => ({
        player_id: id,
        school_id: schoolId,
        measured_date: m.monthsAgo === 0 ? daysAgo(3) : addDays(monthStart(TODAY, -m.monthsAgo), 9),
        height_cm: m.height,
        weight_kg: m.weight,
        eyesight_left: m.eyeL,
        eyesight_right: m.eyeR,
        grip_strength_left: m.gripL,
        grip_strength_right: m.gripR,
        dominant_hand: EQUIPMENT[key].hand,
        racket: EQUIPMENT[key].racket,
        shoes: EQUIPMENT[key].shoes,
        strings: EQUIPMENT[key].strings,
        source: "app",
      }))
    )
  );

  // 6. 月次レポート（上で作成した daily_logs / match_logs から集計）
  const reports = [];
  for (const { key, id } of players) {
    const pub = REPORT_TEXT[key].published;
    const draft = REPORT_TEXT[key].draft;
    reports.push({
      player_id: id,
      school_id: schoolId,
      target_month: LAST_MONTH,
      status: "published",
      summary_stats: await computeStatsForRange(id, LAST_MONTH, THIS_MONTH),
      technical_evaluation: pub.technical,
      mental_evaluation: pub.mental,
      connect_text: pub.connect,
      agreed_theme: pub.theme,
      agreed_notes: pub.notes,
      pdf_path: null,
      published_at: new Date().toISOString(),
    });
    reports.push({
      player_id: id,
      school_id: schoolId,
      target_month: THIS_MONTH,
      status: "draft",
      summary_stats: await computeStatsForRange(id, THIS_MONTH, monthStart(TODAY, 1)),
      technical_evaluation: draft.technical,
      mental_evaluation: draft.mental,
      connect_text: draft.connect,
      agreed_theme: draft.theme,
      agreed_notes: draft.notes,
      pdf_path: null,
      published_at: null,
    });
  }
  await insertRows("monthly_reports", reports);

  // 7. 確認
  console.log("");
  console.log("デモスクール内の件数:", await countDemoSchool(schoolId));
  const nltcAfter = await countNltc();
  const unchanged = JSON.stringify(nltcBefore) === JSON.stringify(nltcAfter);
  console.log("NLTCの件数 実行前:", nltcBefore);
  console.log("NLTCの件数 実行後:", nltcAfter, unchanged ? "→ 変化なし ✅" : "→ ⚠️ 変化あり");
  console.log("");
  console.log(`✅ デモスクールの作成が完了しました。ログイン情報: ${CREDENTIALS_PATH}`);
}

main().catch((err) => {
  console.error("");
  console.error(`❌ 失敗しました: ${err instanceof Error ? err.message : String(err)}`);
  if (progress.length > 0) {
    console.error("途中まで完了した処理:");
    for (const p of progress) console.error(`  - ${p}`);
    console.error("やり直す場合はそのまま再実行できます（冪等）。すべて消す場合: npm run demo:cleanup -- --yes");
  } else {
    console.error("書き込みは行われていません。");
  }
  process.exit(1);
});
