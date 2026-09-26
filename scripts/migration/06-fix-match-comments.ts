/**
 * 試合履歴の仮コメント（「あ」「ああああ」等）を、
 * 実際の投稿らしい内容に書き直すだけの、小さな修正スクリプト。
 *
 * 実行前に環境変数を設定（.env.localに既にある値を利用可）:
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 使い方:
 *   npm run fix:match-comments
 */
import "dotenv/config";
import { adminClient } from "./client";

async function main() {
  console.log("試合履歴のコメントを修正します...");

  const fixes = [
    {
      match: { good_points: "あ" },
      update: {
        good_points: "セカンドサーブが安定していて、粘り強く得点を重ねられた。",
        bad_next_points: "ネットプレーの精度をもっと上げたい。",
      },
    },
    {
      match: { good_points: "ああああ" },
      update: {
        good_points: "苦しい展開でも最後まで足を止めずに戦えた。",
        bad_next_points: "リターンの精度を上げて、先手を取れるようにする。",
      },
    },
  ];

  for (const fix of fixes) {
    const { data, error } = await adminClient
      .from("match_logs")
      .update(fix.update)
      .match(fix.match)
      .select("id");
    if (error) {
      console.error("  [警告] コメント更新に失敗:", error.message);
    } else {
      console.log(`  [OK] ${data?.length ?? 0}件のコメントを更新 (元コメント: "${fix.match.good_points}")`);
    }
  }

  console.log("\n完了しました。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
