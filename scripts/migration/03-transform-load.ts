/**
 * Step 3: ステージングテーブルのデータをクレンジング・型変換し、
 * migration_name_map で解決した player_id とともに本番テーブルへ投入する。
 *
 * 使い方:
 *   npm run migrate:transform-load -- --type=daily
 *   npm run migrate:transform-load -- --type=match
 *   npm run migrate:transform-load -- --type=goal
 *   npm run migrate:transform-load -- --type=all
 *
 * 前提: Step2 (build-name-map) で migration_name_map が確定していること。
 * 未解決の氏名（migration_name_mapに存在しない raw_player_name）を含む行は
 * 本番投入せず、コンソールとエラーレポートファイルに出力する。
 */
import "dotenv/config";
import fs from "node:fs";
import { adminClient, getNltcSchoolId } from "./client";

type ErrorRow = { table: string; sourceFile: string | null; sourceRow: number | null; reason: string; raw: unknown };

const errors: ErrorRow[] = [];

function parseArgs() {
  const args = process.argv.slice(2);
  const type = (args.find((a) => a.startsWith("--type="))?.split("=")[1] ?? "all") as
    | "daily"
    | "match"
    | "goal"
    | "all";
  return { type };
}

/** "2026/7/11" のような表記を "2026-07-11" に正規化する */
function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** "2026年3月" / "2026-03" / "2026/3" 等を月初日 "2026-03-01" に正規化する */
function parseTargetMonth(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4})[年\/\-](\d{1,2})月?$/);
  if (!m) return null;
  const [, y, mo] = m;
  return `${y}-${mo.padStart(2, "0")}-01`;
}

function parseNumeric(raw: string | null, min: number, max: number): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw.trim());
  if (Number.isNaN(n)) return null;
  if (n < min || n > max) return null; // 範囲外は欠損扱いにし、エラーレポートに出す
  return n;
}

function parseHasPain(raw: string | null): boolean {
  return raw?.trim() === "あり";
}

function parsePainLocations(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[、,・\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const ROUND_MAP: Record<string, string> = {
  予選: "qualifying",
  "1R": "r1",
  "2R": "r2",
  QF: "qf",
  SF: "sf",
  F: "f",
  順位戦: "placement",
  練習試合: "practice",
};

const SURFACE_MAP: Record<string, string> = {
  オムニ: "omni",
  クレー: "clay",
  ハード: "hard",
  "インドア(カーペット)": "indoor",
  インドア: "indoor",
};

const RESULT_MAP: Record<string, string> = { 勝ち: "win", 負け: "lose" };

async function loadNameMap(schoolId: string): Promise<Map<string, string>> {
  const { data, error } = await adminClient
    .from("migration_name_map")
    .select("raw_name, resolved_player_id")
    .eq("school_id", schoolId);
  if (error) throw new Error(`migration_name_map の取得に失敗しました: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.resolved_player_id) map.set(row.raw_name, row.resolved_player_id);
  }
  return map;
}

async function transformDaily(schoolId: string, nameMap: Map<string, string>) {
  const { data: staged, error } = await adminClient.from("staging_daily_logs").select("*");
  if (error) throw new Error(error.message);

  // (player_id, log_date) の重複はタイムスタンプが新しい方を採用し、他は migration_duplicates へ退避
  const latestByKey = new Map<string, (typeof staged)[number]>();
  const duplicates: (typeof staged)[number][] = [];

  for (const row of staged ?? []) {
    const playerId = nameMap.get(row.raw_player_name.trim());
    if (!playerId) {
      errors.push({
        table: "daily_logs",
        sourceFile: row.source_file,
        sourceRow: row.source_row_number,
        reason: `未解決の選手名: "${row.raw_player_name}"`,
        raw: row,
      });
      continue;
    }
    const logDate = parseDate(row.raw_date);
    if (!logDate) {
      errors.push({
        table: "daily_logs",
        sourceFile: row.source_file,
        sourceRow: row.source_row_number,
        reason: `日付を解釈できません: "${row.raw_date}"`,
        raw: row,
      });
      continue;
    }
    const key = `${playerId}__${logDate}`;
    const existing = latestByKey.get(key);
    if (!existing) {
      latestByKey.set(key, row);
    } else {
      const existingTs = existing.raw_timestamp ?? "";
      const currentTs = row.raw_timestamp ?? "";
      if (currentTs > existingTs) {
        duplicates.push(existing);
        latestByKey.set(key, row);
      } else {
        duplicates.push(row);
      }
    }
  }

  for (const dup of duplicates) {
    await adminClient.from("migration_duplicates").insert({
      school_id: schoolId,
      source_table: "daily_logs",
      raw_data: dup,
      reason: "同一選手・同一日付の重複入力のため不採用",
    });
  }

  const records = Array.from(latestByKey.entries()).map(([key, row]) => {
    const [playerId, logDate] = key.split("__");
    const sleepHours = parseNumeric(row.raw_sleep_hours, 0, 14);
    const fatigueLevel = parseNumeric(row.raw_fatigue_level, 1, 10);
    const selfScore = parseNumeric(row.raw_self_score, 1, 10);

    if (row.raw_sleep_hours && sleepHours === null) {
      errors.push({ table: "daily_logs", sourceFile: row.source_file, sourceRow: row.source_row_number, reason: `睡眠時間が範囲外/不正: "${row.raw_sleep_hours}"`, raw: row });
    }

    return {
      player_id: playerId,
      school_id: schoolId,
      log_date: logDate,
      sleep_hours: sleepHours,
      fatigue_level: fatigueLevel,
      has_pain: parseHasPain(row.raw_has_pain),
      pain_locations: parsePainLocations(row.raw_pain_locations),
      self_score: selfScore,
      notes: row.raw_notes || null,
      coach_message: row.raw_coach_message || null,
      source: "migrated",
    };
  });

  if (records.length > 0) {
    const { error: insertError } = await adminClient
      .from("daily_logs")
      .upsert(records, { onConflict: "player_id,log_date" });
    if (insertError) throw new Error(`daily_logs投入に失敗: ${insertError.message}`);
  }

  console.log(`✅ daily_logs: ${records.length} 件投入（重複退避 ${duplicates.length} 件、エラー ${errors.filter((e) => e.table === "daily_logs").length} 件）`);
}

async function transformMatch(schoolId: string, nameMap: Map<string, string>) {
  const { data: staged, error } = await adminClient.from("staging_match_logs").select("*");
  if (error) throw new Error(error.message);

  const records = [];
  for (const row of staged ?? []) {
    const playerId = nameMap.get(row.raw_player_name.trim());
    if (!playerId) {
      errors.push({ table: "match_logs", sourceFile: row.source_file, sourceRow: row.source_row_number, reason: `未解決の選手名: "${row.raw_player_name}"`, raw: row });
      continue;
    }
    const matchDate = parseDate(row.raw_match_date);
    if (!matchDate) {
      errors.push({ table: "match_logs", sourceFile: row.source_file, sourceRow: row.source_row_number, reason: `試合日を解釈できません: "${row.raw_match_date}"`, raw: row });
      continue;
    }
    if (!row.raw_tournament_name) {
      errors.push({ table: "match_logs", sourceFile: row.source_file, sourceRow: row.source_row_number, reason: "大会名が空です", raw: row });
      continue;
    }

    const round = row.raw_round ? ROUND_MAP[row.raw_round.trim()] ?? null : null;
    const surface = row.raw_surface ? SURFACE_MAP[row.raw_surface.trim()] ?? null : null;
    const result = row.raw_result ? RESULT_MAP[row.raw_result.trim()] ?? null : null;

    if (row.raw_round && !round) {
      errors.push({ table: "match_logs", sourceFile: row.source_file, sourceRow: row.source_row_number, reason: `未知のラウンド表記: "${row.raw_round}"`, raw: row });
    }
    if (row.raw_surface && !surface) {
      errors.push({ table: "match_logs", sourceFile: row.source_file, sourceRow: row.source_row_number, reason: `未知のサーフェス表記: "${row.raw_surface}"`, raw: row });
    }

    records.push({
      player_id: playerId,
      school_id: schoolId,
      match_date: matchDate,
      tournament_name: row.raw_tournament_name,
      tournament_grade: row.raw_tournament_grade || null,
      round,
      opponent_name: row.raw_opponent_name || null,
      opponent_club: row.raw_opponent_club || null,
      result,
      score: row.raw_score || null,
      surface,
      good_points: row.raw_good_points || null,
      bad_next_points: row.raw_bad_next_points || null,
      source: "migrated",
    });
  }

  if (records.length > 0) {
    const { error: insertError } = await adminClient.from("match_logs").insert(records);
    if (insertError) throw new Error(`match_logs投入に失敗: ${insertError.message}`);
  }

  console.log(`✅ match_logs: ${records.length} 件投入（エラー ${errors.filter((e) => e.table === "match_logs").length} 件）`);
}

async function transformGoal(schoolId: string, nameMap: Map<string, string>) {
  const { data: staged, error } = await adminClient.from("staging_goal_logs").select("*");
  if (error) throw new Error(error.message);

  const latestByKey = new Map<string, (typeof staged)[number]>();
  const duplicates: (typeof staged)[number][] = [];

  for (const row of staged ?? []) {
    const playerId = nameMap.get(row.raw_player_name.trim());
    if (!playerId) {
      errors.push({ table: "goal_logs", sourceFile: row.source_file, sourceRow: row.source_row_number, reason: `未解決の選手名: "${row.raw_player_name}"`, raw: row });
      continue;
    }
    const targetMonth = parseTargetMonth(row.raw_target_month);
    if (!targetMonth) {
      errors.push({ table: "goal_logs", sourceFile: row.source_file, sourceRow: row.source_row_number, reason: `対象月を解釈できません: "${row.raw_target_month}"`, raw: row });
      continue;
    }
    const key = `${playerId}__${targetMonth}`;
    if (latestByKey.has(key)) {
      duplicates.push(row); // 月次目標は基本1件のはずだが、重複があれば先勝ちで採用し残りは退避
      continue;
    }
    latestByKey.set(key, row);
  }

  for (const dup of duplicates) {
    await adminClient.from("migration_duplicates").insert({
      school_id: schoolId,
      source_table: "goal_logs",
      raw_data: dup,
      reason: "同一選手・同一対象月の重複入力のため不採用",
    });
  }

  const records = Array.from(latestByKey.entries()).map(([key, row]) => {
    const [playerId, targetMonth] = key.split("__");
    return {
      player_id: playerId,
      school_id: schoolId,
      target_month: targetMonth,
      technical_goal: row.raw_technical_goal || null,
      physical_goal: row.raw_physical_goal || null,
      action_plan: row.raw_action_plan || null,
      source: "migrated",
    };
  });

  if (records.length > 0) {
    const { error: insertError } = await adminClient
      .from("goal_logs")
      .upsert(records, { onConflict: "player_id,target_month" });
    if (insertError) throw new Error(`goal_logs投入に失敗: ${insertError.message}`);
  }

  console.log(`✅ goal_logs: ${records.length} 件投入（エラー ${errors.filter((e) => e.table === "goal_logs").length} 件）`);
}

async function main() {
  const { type } = parseArgs();
  const schoolId = await getNltcSchoolId();
  const nameMap = await loadNameMap(schoolId);

  if (nameMap.size === 0) {
    throw new Error("migration_name_map が空です。先に Step2 (build-name-map) を実行してください");
  }

  if (type === "daily" || type === "all") await transformDaily(schoolId, nameMap);
  if (type === "match" || type === "all") await transformMatch(schoolId, nameMap);
  if (type === "goal" || type === "all") await transformGoal(schoolId, nameMap);

  if (errors.length > 0) {
    const path = "scripts/migration/transform-errors.json";
    fs.writeFileSync(path, JSON.stringify(errors, null, 2), "utf-8");
    console.warn(`⚠️ ${errors.length} 件のエラー・要確認行を ${path} に出力しました。内容を確認してください。`);
  } else {
    console.log("🎉 エラーなく完了しました");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
