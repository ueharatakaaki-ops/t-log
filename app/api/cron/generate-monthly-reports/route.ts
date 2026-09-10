import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateDraftReportForPlayer } from "@/lib/reports/generate-draft-report";
import { defaultReportTargetMonth } from "@/lib/date";

// Vercel Cron から毎月1日の朝(JST)に呼び出される想定（vercel.json参照）。
// 在籍中の全選手について、先月分の月次レポートをdraftステータスで自動生成する。
// 公開（published）まではコーチが内容を確認して手動で行う（既存の運用のまま変更しない）。
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetMonth = defaultReportTargetMonth(); // "YYYY-MM-01"（先月分）
  const admin = createAdminClient();

  const { data: players, error } = await admin
    .from("players")
    .select("id, school_id")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: "選手一覧の取得に失敗しました" }, { status: 500 });
  }

  const targets = players ?? [];
  const results = await Promise.allSettled(
    targets.map((p) => generateDraftReportForPlayer(p.school_id, p.id, targetMonth))
  );

  const failures: { playerId: string; error: string }[] = [];
  // AI文章生成（技術・メンタル評価/CONNECT）が失敗した場合、レポート自体の生成は
  // 成功扱いのままなので原因を別途ここに集めて確認できるようにする
  const narrativeIssues: { playerId: string; error: string }[] = [];
  let succeeded = 0;

  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.ok) {
      succeeded += 1;
      if (result.value.narrative.status === "failed") {
        narrativeIssues.push({ playerId: targets[i].id, error: result.value.narrative.error });
      }
    } else if (result.status === "fulfilled" && !result.value.ok) {
      // 既に公開済みでスキップされたケースも含まれるため、失敗とは限らない
      failures.push({ playerId: targets[i].id, error: result.value.error });
    } else if (result.status === "rejected") {
      failures.push({ playerId: targets[i].id, error: String(result.reason) });
    }
  });

  return NextResponse.json({
    targetMonth,
    totalPlayers: targets.length,
    succeeded,
    skippedOrFailed: failures,
    narrativeIssues,
  });
}
