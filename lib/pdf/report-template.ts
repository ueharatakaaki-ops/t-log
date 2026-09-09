import type { MonthlyReportDetail } from "@/lib/queries/monthly-report-detail";
import { calculateAge, getAgeBasedCommentary } from "@/lib/reports/age-commentary";

export type MatchCardData = {
  matchDate: string;
  tournamentName: string;
  tournamentGrade: string | null;
  surface: string | null;
  result: "win" | "lose" | null;
  score: string | null;
  goodPoints: string | null;
  badNextPoints: string | null;
};

const SURFACE_LABEL: Record<string, string> = {
  omni: "オムニ",
  clay: "クレー",
  hard: "ハード",
  indoor: "インドア(カーペット)",
};

// NLTC公式ブランドカラー。以前はここが #0f172a / #10b981 / #f1f5f9 という
// 近いが微妙に異なる値になっており、アプリ内の他画面（text-[#0F2537]等）とは
// 厳密には一致していなかった。実際に保護者・選手に配られるPDFの色なので、
// ここを正確な値に揃える。
const COLORS = {
  navy: "#0F2537",
  emerald: "#00A859",
  bg: "#F4F6F8",
  alertRed: "#f43f5e",
  alertOrange: "#f97316",
};

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function multilineBlock(label: string, value: string | null, minLines = 3): string {
  if (value && value.trim().length > 0) {
    return `<div class="field"><p class="field-label">${label}</p><p class="field-value">${escapeHtml(value)}</p></div>`;
  }
  // 未入力の場合は手書き記入用の罫線を表示する（印刷して手渡す運用を想定）
  const lines = Array.from({ length: minLines })
    .map(() => `<div class="handwrite-line"></div>`)
    .join("");
  return `<div class="field"><p class="field-label">${label}</p>${lines}</div>`;
}

export function buildMonthlyReportHtml(report: MonthlyReportDetail, matches: MatchCardData[]): string {
  const stats = report.summaryStats;
  const age = calculateAge(report.birthdate);
  const ageCommentary = getAgeBasedCommentary(age);
  const [year, month] = report.targetMonth.split("-");
  const issueDate = new Date().toLocaleDateString("ja-JP");

  const chartLabels = (stats?.dailySeries ?? []).map((d) => d.date.slice(5));
  const chartSleep = (stats?.dailySeries ?? []).map((d) => d.sleepHours);
  const chartFatigue = (stats?.dailySeries ?? []).map((d) => d.fatigueLevel);

  const painSummary =
    stats && stats.painDays.length > 0
      ? stats.painDays.map((p) => `${p.date.slice(5)}: ${p.locations.join("・")}`).join(" / ")
      : "なし";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: "Noto Sans JP", sans-serif;
    color: #1e293b;
    margin: 0;
  }
  .page {
    width: 210mm;
    height: 297mm;
    padding: 12mm;
    page-break-after: always;
    position: relative;
  }
  .page:last-child { page-break-after: auto; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 3px solid ${COLORS.navy};
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
  .header h1 { font-size: 18px; color: ${COLORS.navy}; margin: 0; }
  .header .sub { font-size: 11px; color: #64748b; }
  .profile-row { display: flex; gap: 16px; margin-bottom: 16px; font-size: 12px; }
  .profile-row .label { color: #94a3b8; }
  .quick-view { display: flex; gap: 10px; margin-bottom: 16px; }
  .quick-card {
    flex: 1;
    background: ${COLORS.bg};
    border-radius: 10px;
    padding: 10px;
    text-align: center;
  }
  .quick-card .value { font-size: 22px; font-weight: 700; color: ${COLORS.emerald}; }
  .quick-card .label { font-size: 10px; color: #64748b; }
  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: ${COLORS.navy};
    margin: 18px 0 8px;
    border-left: 4px solid ${COLORS.emerald};
    padding-left: 8px;
  }
  .commentary-item {
    font-size: 11px;
    color: #334155;
    background: ${COLORS.bg};
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: 6px;
  }
  .two-col { display: flex; gap: 16px; }
  .col { flex: 1; }
  .field { margin-bottom: 12px; }
  .field-label { font-size: 10px; color: #94a3b8; margin: 0 0 2px; }
  .field-value { font-size: 12px; margin: 0; white-space: pre-wrap; }
  .handwrite-line { border-bottom: 1px dashed #cbd5e1; height: 16px; }
  .connect-card {
    background: ${COLORS.navy};
    color: white;
    border-radius: 14px;
    padding: 16px;
    margin: 16px 0;
  }
  .connect-card .title { font-size: 12px; font-weight: 700; color: ${COLORS.emerald}; margin-bottom: 6px; }
  .connect-card .body { font-size: 12px; white-space: pre-wrap; line-height: 1.6; }
  .match-card {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .match-card .top { display: flex; justify-content: space-between; align-items: center; }
  .match-card .tournament { font-weight: 700; font-size: 13px; }
  .badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; color: white; }
  .badge.win { background: ${COLORS.emerald}; }
  .badge.lose { background: ${COLORS.alertRed}; }
  .match-meta { font-size: 10px; color: #64748b; margin: 4px 0 8px; }
  .match-analysis { display: flex; gap: 10px; font-size: 11px; }
  .match-analysis .col { background: ${COLORS.bg}; border-radius: 8px; padding: 6px 8px; }
  .page-num { position: absolute; top: 12mm; right: 12mm; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>

<!-- Page 1: コンディション & フィジカル分析 -->
<div class="page">
  <div class="header">
    <div>
      <h1>NLTC Junior Team</h1>
      <div class="sub">アスリート月次分析レポート — ${year}年${Number(month)}月度</div>
    </div>
    <div class="sub">発行日: ${issueDate}</div>
  </div>

  <div class="profile-row">
    <div><span class="label">選手名: </span>${escapeHtml(report.playerName)}</div>
    <div><span class="label">満年齢: </span>${age ?? "-"}歳</div>
    <div><span class="label">学年: </span>${escapeHtml(report.grade) || "-"}</div>
    <div><span class="label">カテゴリー: </span>${escapeHtml(report.category) || "-"}</div>
  </div>

  <div class="section-title">Condition Status & 体調・痛みチェック</div>
  <p style="font-size:12px;">今月の痛み・違和感の申告: ${escapeHtml(painSummary)}</p>

  <div class="quick-view">
    <div class="quick-card"><div class="value">${stats?.loggedDays ?? 0}</div><div class="label">入力日数</div></div>
    <div class="quick-card"><div class="value">${stats?.matchCount ?? 0}</div><div class="label">試合報告数</div></div>
    <div class="quick-card"><div class="value">${stats?.avgSleepHours ?? "-"}</div><div class="label">平均睡眠(h)</div></div>
    <div class="quick-card"><div class="value">${stats?.avgFatigueLevel ?? "-"}</div><div class="label">平均疲労度</div></div>
  </div>

  <div class="section-title">コンディショントレンド</div>
  <canvas id="trendChart" width="700" height="260"></canvas>

  <div class="section-title">年齢からわかる医学的・フィジカル基準</div>
  ${ageCommentary.map((c) => `<div class="commentary-item">${escapeHtml(c)}</div>`).join("")}
</div>

<!-- Page 2: 詳細技術・メンタル・CONNECT分析 -->
<div class="page">
  <div class="page-num">${escapeHtml(report.playerName)} (2/3)</div>
  <div class="two-col">
    <div class="col">
      <div class="section-title">技術・戦術面の記録</div>
      ${multilineBlock("コーチによる技術評価", report.technicalEvaluation)}
    </div>
    <div class="col">
      <div class="section-title">メンタル・取り組み姿勢の記録</div>
      ${multilineBlock("コーチによるメンタル評価", report.mentalEvaluation)}
    </div>
  </div>

  <div class="connect-card">
    <div class="title">CONNECT</div>
    <div class="body">${report.connectText ? escapeHtml(report.connectText) : "（コーチが今月のCONNECTコメントを入力するとここに表示されます）"}</div>
  </div>

  <div class="section-title">合意形成メモ</div>
  <div class="two-col">
    <div class="col">${multilineBlock("今後の技術テーマ", report.agreedTheme)}</div>
    <div class="col">${multilineBlock("今後の決め事・アドバイス", report.agreedNotes)}</div>
  </div>
</div>

<!-- Page 3: Match Log -->
<div class="page">
  <div class="page-num">${escapeHtml(report.playerName)} (3/3)</div>
  <div class="section-title">Match Log（今月の対外試合記録）</div>
  ${
    matches.length === 0
      ? `<p style="font-size:12px;color:#94a3b8;">今月の試合報告はありません</p>`
      : matches
          .map(
            (m) => `
    <div class="match-card">
      <div class="top">
        <span class="tournament">${escapeHtml(m.tournamentName)}</span>
        ${m.result ? `<span class="badge ${m.result}">${m.result === "win" ? "WIN" : "LOSE"}</span>` : ""}
      </div>
      <div class="match-meta">
        ${m.matchDate} ／ ${m.tournamentGrade ? escapeHtml(m.tournamentGrade) + " ／ " : ""}${m.surface ? SURFACE_LABEL[m.surface] ?? "" : ""}${m.score ? " ／ " + escapeHtml(m.score) : ""}
      </div>
      <div class="match-analysis">
        <div class="col"><b>GOOD:</b> ${escapeHtml(m.goodPoints) || "-"}</div>
        <div class="col"><b>Bad/Next:</b> ${escapeHtml(m.badNextPoints) || "-"}</div>
      </div>
    </div>`
          )
          .join("")
  }
</div>

<script>
  // Puppeteer側でチャート描画完了を待ってからPDF化するため、window.__chartReady__ を立てる
  window.__chartReady__ = false;
  const ctx = document.getElementById('trendChart');
  if (ctx) {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(chartLabels)},
        datasets: [
          {
            type: 'bar',
            label: '睡眠時間(h)',
            data: ${JSON.stringify(chartSleep)},
            backgroundColor: '${COLORS.emerald}',
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: '疲労度',
            data: ${JSON.stringify(chartFatigue)},
            borderColor: '${COLORS.alertRed}',
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: false,
        animation: { onComplete: () => { window.__chartReady__ = true; } },
        scales: {
          y: { position: 'left', min: 0, max: 12 },
          y1: { position: 'right', min: 0, max: 10, grid: { drawOnChartArea: false } },
        },
      },
    });
  } else {
    window.__chartReady__ = true;
  }
</script>
</body>
</html>`;
}
