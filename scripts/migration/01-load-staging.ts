/**
 * Step 1: 既存GoogleスプレッドシートからエクスポートしたCSVを
 * ステージングテーブルへそのまま（型変換前）取り込む。
 *
 * 使い方:
 *   npm run migrate:load-staging -- --type=daily --file=raw_backup/daily_2026-05.csv
 *   npm run migrate:load-staging -- --type=match --file=raw_backup/match_2026-05.csv
 *   npm run migrate:load-staging -- --type=goal  --file=raw_backup/goal_2026-05.csv
 *
 * 事前準備:
 *   1. Googleスプレッドシートを「変更不可のバックアップ」としてCSVエクスポートし、
 *      raw_backup/ 配下に保存しておく（このスクリプトは raw_backup/ を書き換えない）。
 *   2. セル内改行を含む行がある場合、GoogleスプレッドシートのCSVエクスポートは
 *      RFC4180準拠のクォート処理をしているはずだが、崩れている場合は
 *      該当行だけ手動修正してから実行する（Phase0レビュー STEP4参照）。
 */
import "dotenv/config";
import fs from "node:fs";
import Papa from "papaparse";
import { adminClient, getNltcSchoolId } from "./client";

type LogType = "daily" | "match" | "goal";

function parseArgs() {
  const args = process.argv.slice(2);
  const type = args.find((a) => a.startsWith("--type="))?.split("=")[1] as LogType | undefined;
  const file = args.find((a) => a.startsWith("--file="))?.split("=")[1];
  if (!type || !file) {
    throw new Error("使い方: --type=daily|match|goal --file=<CSVパス>");
  }
  if (!["daily", "match", "goal"].includes(type)) {
    throw new Error(`不明な --type です: ${type}`);
  }
  return { type, file };
}

// 元のGoogleフォーム項目名 → ステージングテーブル列名のマッピング。
// 表記が完全一致しない場合に備え、複数の候補列名を許容する。
const DAILY_COLUMN_MAP: Record<string, string[]> = {
  raw_timestamp: ["タイムスタンプ"],
  raw_date: ["日付"],
  raw_player_name: ["選手氏名"],
  raw_sleep_hours: ["睡眠時間"],
  raw_fatigue_level: ["今日の疲労度"],
  raw_has_pain: ["体に痛み・違和感はありますか？", "体に痛み・違和感はありますか"],
  raw_pain_locations: ["痛みの箇所（「あり」の人）", "痛む部位", "痛みの箇所"],
  raw_self_score: ["今日の自己採点"],
  raw_notes: ["本日の気づき・反省"],
  raw_coach_message: ["連絡事項"],
};

const MATCH_COLUMN_MAP: Record<string, string[]> = {
  raw_player_name: ["選手氏名"],
  raw_match_date: ["試合日"],
  raw_tournament_name: ["大会名"],
  raw_tournament_grade: ["大会グレード・レベル"],
  raw_round: ["ラウンド", "ラウンド（回戦）"],
  raw_opponent_name: ["対戦相手", "対戦相手・所属クラブ"],
  raw_opponent_club: ["対戦相手・所属クラブ", "所属クラブ"],
  raw_result: ["勝敗"],
  raw_score: ["スコア"],
  raw_surface: ["コートサーフェス"],
  raw_good_points: ["良かった点（GOOD）", "良かった点"],
  raw_bad_next_points: ["悪かった点・次への課題 (Bad/Next)", "悪かった点・次への課題"],
};

const GOAL_COLUMN_MAP: Record<string, string[]> = {
  raw_player_name: ["選手氏名"],
  raw_target_month: ["対象月"],
  raw_technical_goal: ["今期の強化テーマ（技術・戦術の目標）", "今期の強化テーマ"],
  raw_physical_goal: ["フィジカル・生活の目標"],
  raw_action_plan: ["アクションプラン（達成するための具体的行動）", "アクションプラン"],
};

function pickColumn(row: Record<string, string>, candidates: string[]): string | null {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") return row[c];
  }
  return null;
}

async function main() {
  const { type, file } = parseArgs();
  const schoolId = await getNltcSchoolId();

  const csvText = fs.readFileSync(file, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.warn(`CSVパース中に ${parsed.errors.length} 件の警告があります（構造崩れの可能性）:`);
    parsed.errors.slice(0, 5).forEach((e) => console.warn(`  row ${e.row}: ${e.message}`));
  }

  const rows = parsed.data;
  const columnMap =
    type === "daily" ? DAILY_COLUMN_MAP : type === "match" ? MATCH_COLUMN_MAP : GOAL_COLUMN_MAP;
  const tableName =
    type === "daily" ? "staging_daily_logs" : type === "match" ? "staging_match_logs" : "staging_goal_logs";

  const records = rows.map((row, i) => {
    const base: Record<string, string | number | null> = { school_id: schoolId, source_file: file, source_row_number: i + 2 };
    for (const [col, candidates] of Object.entries(columnMap)) {
      base[col] = pickColumn(row, candidates);
    }
    return base;
  });

  // 必須列（氏名・日付系）が欠けている行は投入前に警告を出す
  const requiredKey = type === "daily" ? "raw_date" : type === "match" ? "raw_match_date" : "raw_target_month";
  const invalidRows = records.filter((r) => !r.raw_player_name || !r[requiredKey]);
  if (invalidRows.length > 0) {
    console.warn(
      `氏名または${requiredKey}が空の行が ${invalidRows.length} 件あります（source_row_numberを確認: ${invalidRows
        .map((r) => r.source_row_number)
        .join(", ")}）`
    );
  }

  const { error, count } = await adminClient.from(tableName).insert(records).select("id", { count: "exact" });

  if (error) {
    throw new Error(`ステージングテーブルへの投入に失敗しました: ${error.message}`);
  }

  console.log(`✅ ${file} から ${count ?? records.length} 件を ${tableName} へ投入しました`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
