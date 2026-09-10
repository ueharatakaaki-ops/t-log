import { createAdminClient } from "@/lib/supabase/server";
import { computeMonthlySummaryStats } from "@/lib/reports/compute-summary-stats";
import { calculateAge } from "@/lib/reports/age-commentary";
import { generateReportNarrative, type NarrativeMatch, type NarrativeDailyNote } from "@/lib/reports/generate-narrative";

export type GenerateDraftReportResult = { ok: true; reportId: string } | { ok: false; error: string };

function previousTargetMonth(targetMonth: string): string {
  const [y, m] = targetMonth.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

function nextMonthExclusive(targetMonth: string): string {
  const [y, m] = targetMonth.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/**
 * 対象月の自動集計値を計算し、monthly_reports に draft ステータスで保存する共通ロジック。
 * - コーチ画面からの手動生成（app/(coach)/reports/manage/actions.ts）
 * - 月初に自動実行するCronジョブ（app/api/cron/generate-monthly-reports/route.ts）
 * の両方から呼び出す。呼び出し元での認可（コーチ本人 or Cronシークレット）は
 * それぞれの呼び出し側の責務とし、ここではDBアクセスと集計のみを行う。
 *
 * 既に draft/reviewed の場合は summary_stats のみ再計算して上書きする
 * （published 済みのレポートは再現性を保つため上書きしない）。
 *
 * 数値集計に加えて、技術・メンタル評価とCONNECT（因果関係の分析）の文章も
 * AI（Claude API）で自動生成する。これまでコーチではなくGeminiに書いてもらっていた
 * 部分を引き継ぐもので、「今後の技術テーマ／決め事」（コーチ自身の考察）はここでは
 * 生成せず、引き続きコーチがアプリ上で入力する。
 * AI生成は失敗してもレポート自体の生成は失敗させない（ベストエフォート）。
 * また、コーチが既に技術・メンタル評価等を入力/編集済みの場合は上書きしない。
 */
export async function generateDraftReportForPlayer(
  schoolId: string,
  playerId: string,
  targetMonth: string
): Promise<GenerateDraftReportResult> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("monthly_reports")
    .select("id, status, technical_evaluation, mental_evaluation, connect_text")
    .eq("player_id", playerId)
    .eq("target_month", targetMonth)
    .maybeSingle();

  if (existing?.status === "published") {
    return { ok: false, error: "公開済みのレポートは自動再生成できません" };
  }

  const stats = await computeMonthlySummaryStats(playerId, targetMonth);

  const { data, error } = await admin
    .from("monthly_reports")
    .upsert(
      {
        player_id: playerId,
        school_id: schoolId,
        target_month: targetMonth,
        status: "draft",
        summary_stats: stats,
      },
      { onConflict: "player_id,target_month" }
    )
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "レポートの生成に失敗しました" };
  }

  // コーチが既に技術・メンタル評価やCONNECTを入力/編集済みなら、AIで上書きしない
  const alreadyHasNarrative =
    !!existing?.technical_evaluation || !!existing?.mental_evaluation || !!existing?.connect_text;

  if (!alreadyHasNarrative) {
    await tryFillNarrative(admin, data.id, playerId, targetMonth, stats);
  }

  return { ok: true, reportId: data.id };
}

/** AIによる技術・メンタル評価/CONNECTの自動生成を試みる。失敗してもレポート生成自体は成功のまま扱う。 */
async function tryFillNarrative(
  admin: ReturnType<typeof createAdminClient>,
  reportId: string,
  playerId: string,
  targetMonth: string,
  stats: Awaited<ReturnType<typeof computeMonthlySummaryStats>>
): Promise<void> {
  try {
    const [player, dailyLogs, matchLogs, previousReport] = await Promise.all([
      admin.from("players").select("full_name, birthdate, grade, category").eq("id", playerId).single(),
      admin
        .from("daily_logs")
        .select("log_date, self_score, fatigue_level, has_pain, pain_locations, notes")
        .eq("player_id", playerId)
        .gte("log_date", targetMonth)
        .lt("log_date", nextMonthExclusive(targetMonth))
        .order("log_date", { ascending: true }),
      admin
        .from("match_logs")
        .select(
          "match_date, tournament_name, tournament_grade, round, opponent_name, result, score, good_points, bad_next_points"
        )
        .eq("player_id", playerId)
        .gte("match_date", targetMonth)
        .lt("match_date", nextMonthExclusive(targetMonth))
        .order("match_date", { ascending: true }),
      admin
        .from("monthly_reports")
        .select("technical_evaluation, mental_evaluation, agreed_theme, agreed_notes")
        .eq("player_id", playerId)
        .eq("target_month", previousTargetMonth(targetMonth))
        .maybeSingle(),
    ]);

    if (!player.data) return;

    if (dailyLogs.error || matchLogs.error) return;

    const dailyNotes: NarrativeDailyNote[] = (dailyLogs.data ?? []).map((d) => ({
      logDate: d.log_date,
      selfScore: d.self_score,
      fatigueLevel: d.fatigue_level,
      hasPain: d.has_pain,
      painLocations: d.pain_locations ?? [],
      notes: d.notes,
    }));

    const matches: NarrativeMatch[] = (matchLogs.data ?? []).map((m) => ({
      matchDate: m.match_date,
      tournamentName: m.tournament_name,
      tournamentGrade: m.tournament_grade,
      round: m.round,
      opponentName: m.opponent_name,
      result: m.result,
      score: m.score,
      goodPoints: m.good_points,
      badNextPoints: m.bad_next_points,
    }));

    const prev = previousReport.data;

    const result = await generateReportNarrative({
      playerName: player.data.full_name,
      age: calculateAge(player.data.birthdate),
      grade: player.data.grade,
      category: player.data.category,
      targetMonth,
      stats,
      dailyNotes,
      matches,
      previousReport: prev
        ? {
            technicalEvaluation: prev.technical_evaluation,
            mentalEvaluation: prev.mental_evaluation,
            agreedTheme: prev.agreed_theme,
            agreedNotes: prev.agreed_notes,
          }
        : null,
    });

    if (result.ok) {
      await admin
        .from("monthly_reports")
        .update({
          technical_evaluation: result.technicalEvaluation,
          mental_evaluation: result.mentalEvaluation,
          connect_text: result.connectText,
        })
        .eq("id", reportId)
        .neq("status", "published");
    }
    // 失敗時は何もしない。コーチが手動で入力する既存フローにフォールバックする。
  } catch {
    // AI生成の失敗はレポート生成自体を失敗させない
  }
}
