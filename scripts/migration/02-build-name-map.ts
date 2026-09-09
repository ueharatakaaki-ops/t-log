/**
 * Step 2: ステージングテーブル上の氏名表記ゆれを、正式な players テーブルへ名寄せする。
 *
 * 表記ゆれの自動判定は「候補提示」までにとどめ、最終確定は必ず人間が確認する
 * （Phase0レビュー STEP4の方針: 未成年の記録を誤って他人に紐付けるリスクを避けるため）。
 *
 * 使い方:
 *   1. 候補生成:
 *      npm run migrate:build-name-map -- --mode=suggest
 *      → scripts/migration/name-map-review.json が生成される。
 *      → 類似度1.0（完全一致）の行は自動的に migration_name_map (confidence='auto') へ登録される。
 *      → それ以外は "resolvedPlayerId" が候補としてセットされた状態でファイル出力されるので、
 *        人間が中身を確認し、誤りがあれば resolvedPlayerId を手動で書き換える
 *        （該当選手がいない場合は null のままにしておく）。
 *
 *   2. レビュー結果の反映:
 *      npm run migrate:build-name-map -- --mode=apply --file=scripts/migration/name-map-review.json
 *      → resolvedPlayerId が入っている行を migration_name_map (confidence='manual') へ登録する。
 */
import "dotenv/config";
import fs from "node:fs";
import stringSimilarity from "string-similarity";
import { adminClient, getNltcSchoolId } from "./client";

const REVIEW_FILE_DEFAULT = "scripts/migration/name-map-review.json";

type ReviewRow = {
  rawName: string;
  suggestedPlayerId: string | null;
  suggestedPlayerName: string | null;
  similarity: number;
  resolvedPlayerId: string | null; // 人間が確定させる列。suggestedPlayerIdの初期値がコピーされる
  occurrences: number;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "suggest";
  const file = args.find((a) => a.startsWith("--file="))?.split("=")[1] ?? REVIEW_FILE_DEFAULT;
  return { mode, file };
}

async function collectDistinctRawNames(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const table of ["staging_daily_logs", "staging_match_logs", "staging_goal_logs"] as const) {
    const { data, error } = await adminClient.from(table).select("raw_player_name");
    if (error) throw new Error(`${table} の取得に失敗しました: ${error.message}`);
    for (const row of data ?? []) {
      const name = row.raw_player_name?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

async function suggest() {
  const schoolId = await getNltcSchoolId();
  const rawNameCounts = await collectDistinctRawNames();

  const { data: players, error } = await adminClient
    .from("players")
    .select("id, full_name")
    .eq("school_id", schoolId);
  if (error) throw new Error(`players の取得に失敗しました: ${error.message}`);

  const playerNames = (players ?? []).map((p) => p.full_name);

  const reviewRows: ReviewRow[] = [];
  let autoCount = 0;

  for (const [rawName, occurrences] of rawNameCounts.entries()) {
    let best: { target: string; rating: number } | null = null;
    if (playerNames.length > 0) {
      const match = stringSimilarity.findBestMatch(rawName, playerNames);
      best = { target: match.bestMatch.target, rating: match.bestMatch.rating };
    }
    const suggestedPlayer = best ? (players ?? []).find((p) => p.full_name === best!.target) ?? null : null;

    const row: ReviewRow = {
      rawName,
      suggestedPlayerId: suggestedPlayer?.id ?? null,
      suggestedPlayerName: suggestedPlayer?.full_name ?? null,
      similarity: best?.rating ?? 0,
      resolvedPlayerId: suggestedPlayer?.id ?? null,
      occurrences,
    };
    reviewRows.push(row);

    // 完全一致のみ自動確定（confidence='auto'）。それ以外は必ず人間の確認を挟む。
    if (best?.rating === 1) {
      const { error: upsertError } = await adminClient.from("migration_name_map").upsert(
        {
          school_id: schoolId,
          raw_name: rawName,
          resolved_player_id: suggestedPlayer!.id,
          confidence: "auto",
        },
        { onConflict: "school_id,raw_name" }
      );
      if (!upsertError) autoCount++;
    }
  }

  reviewRows.sort((a, b) => a.similarity - b.similarity); // 類似度が低い（=要確認度が高い）順に並べる

  fs.writeFileSync(REVIEW_FILE_DEFAULT, JSON.stringify(reviewRows, null, 2), "utf-8");

  console.log(`✅ 完全一致 ${autoCount} 件を自動登録しました`);
  console.log(
    `📝 ${reviewRows.length - autoCount} 件の要確認候補を ${REVIEW_FILE_DEFAULT} に出力しました。` +
      `resolvedPlayerId を確認・修正のうえ --mode=apply で反映してください。`
  );
}

async function apply(file: string) {
  const schoolId = await getNltcSchoolId();
  const reviewRows: ReviewRow[] = JSON.parse(fs.readFileSync(file, "utf-8"));

  const toApply = reviewRows.filter((r) => r.resolvedPlayerId);
  const skipped = reviewRows.filter((r) => !r.resolvedPlayerId);

  for (const row of toApply) {
    const { error } = await adminClient.from("migration_name_map").upsert(
      {
        school_id: schoolId,
        raw_name: row.rawName,
        resolved_player_id: row.resolvedPlayerId,
        confidence: "manual",
      },
      { onConflict: "school_id,raw_name" }
    );
    if (error) {
      console.error(`❌ ${row.rawName} の登録に失敗: ${error.message}`);
    }
  }

  console.log(`✅ ${toApply.length} 件を migration_name_map へ登録しました`);
  if (skipped.length > 0) {
    console.warn(
      `⚠️ resolvedPlayerId が未設定のため ${skipped.length} 件をスキップしました: ` +
        skipped.map((r) => r.rawName).join(", ")
    );
    console.warn("これらの氏名を含むログは Step3 の変換処理で「未解決」としてエラーレポートに出力されます。");
  }
}

async function main() {
  const { mode, file } = parseArgs();
  if (mode === "suggest") {
    await suggest();
  } else if (mode === "apply") {
    await apply(file);
  } else {
    throw new Error(`不明な --mode です: ${mode}（suggest または apply）`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
