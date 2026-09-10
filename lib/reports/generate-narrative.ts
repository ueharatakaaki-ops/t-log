/**
 * 月次レポートの「技術・戦術面の記録」「メンタル・取り組み姿勢の記録」「CONNECT（因果関係の分析）」
 * を、選手の日誌・試合記録からAI（Claude API）で自動生成する。
 *
 * これまでこの3項目はコーチ自身ではなくGeminiに書いてもらっており、コーチの手は
 * 入っていなかった（=事実ベースで日誌・試合記録を読み込んで文章化する作業自体は
 * 元々AI任せだった）。そのため本関数でも同じ位置づけとして自動生成し、
 * 「今後の技術テーマ」「今後の決め事・アドバイス」（コーチ自身の考察）は含めない
 * ——そちらは引き続きコーチがアプリ上で入力する。
 *
 * 生成に失敗した場合は ok:false を返すのみで、呼び出し側は数値集計の保存を
 * ブロックしない（AI生成はベストエフォートの追加ステップという位置づけ）。
 */

import type { MonthlyReportSummaryStats } from "./compute-summary-stats";

export type NarrativeDailyNote = {
  logDate: string;
  selfScore: number | null;
  fatigueLevel: number | null;
  hasPain: boolean;
  painLocations: string[];
  notes: string | null;
};

export type NarrativeMatch = {
  matchDate: string;
  tournamentName: string;
  tournamentGrade: string | null;
  round: string | null;
  opponentName: string | null;
  result: "win" | "lose" | null;
  score: string | null;
  goodPoints: string | null;
  badNextPoints: string | null;
};

export type NarrativePreviousReport = {
  technicalEvaluation: string | null;
  mentalEvaluation: string | null;
  agreedTheme: string | null;
  agreedNotes: string | null;
} | null;

export type NarrativeInput = {
  playerName: string;
  age: number | null;
  grade: string | null;
  category: string | null;
  targetMonth: string; // "YYYY-MM-01"
  stats: MonthlyReportSummaryStats;
  dailyNotes: NarrativeDailyNote[];
  matches: NarrativeMatch[];
  previousReport: NarrativePreviousReport;
};

export type NarrativeResult =
  | { ok: true; technicalEvaluation: string; mentalEvaluation: string; connectText: string }
  | { ok: false; error: string };

const MODEL = "claude-sonnet-5";

// 3項目をJSONで出力させる方式は、本文中の改行がエスケープされない（生の改行文字が
// 混ざる）などの理由でJSON.parseに失敗するケースが実際に発生した。
// Tool use（Function calling）で構造化出力を強制すれば、APIが返すinputは常に
// パース済みのオブジェクトになりこの種の失敗が起きないため、そちらに切り替える。
const NARRATIVE_TOOL = {
  name: "record_report_narrative",
  description: "月次レポートの技術・戦術面の記録、メンタル・取り組み姿勢の記録、CONNECT（因果関係の分析）を記録する。",
  input_schema: {
    type: "object" as const,
    properties: {
      technicalEvaluation: { type: "string", description: "技術・戦術面の記録・事実ベース" },
      mentalEvaluation: { type: "string", description: "メンタル・取り組み姿勢の記録" },
      connectText: { type: "string", description: "CONNECT：技術の繋がり・因果関係の分析" },
    },
    required: ["technicalEvaluation", "mentalEvaluation", "connectText"],
  },
};

export async function generateReportNarrative(input: NarrativeInput): Promise<NarrativeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY が設定されていません" };
  }

  // 書くべき出来事が何もない月はAIを呼ばずスキップする（無駄なAPI呼び出しを避ける）
  if (input.dailyNotes.length === 0 && input.matches.length === 0) {
    return { ok: false, error: "対象月の日誌・試合記録が0件のため生成をスキップしました" };
  }

  const prompt = buildPrompt(input);

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
        tools: [NARRATIVE_TOOL],
        tool_choice: { type: "tool", name: NARRATIVE_TOOL.name },
      }),
    });
  } catch {
    return { ok: false, error: "AI呼び出し中に通信エラーが発生しました" };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, error: `AI呼び出しに失敗しました (status ${response.status}) ${body.slice(0, 200)}` };
  }

  const data = await response.json();

  if (data?.stop_reason === "max_tokens") {
    return { ok: false, error: "AIの応答が長すぎて途中で打ち切られました（max_tokens超過）" };
  }

  const toolUse = (data?.content ?? []).find(
    (block: { type?: string; name?: string }) => block?.type === "tool_use" && block?.name === NARRATIVE_TOOL.name
  );
  const parsed = toolUse?.input as
    | { technicalEvaluation?: string; mentalEvaluation?: string; connectText?: string }
    | undefined;

  if (!parsed || !parsed.technicalEvaluation || !parsed.mentalEvaluation || !parsed.connectText) {
    return { ok: false, error: "AIの応答から必要な項目を取得できませんでした" };
  }

  return {
    ok: true,
    technicalEvaluation: parsed.technicalEvaluation,
    mentalEvaluation: parsed.mentalEvaluation,
    connectText: parsed.connectText,
  };
}

function buildPrompt(input: NarrativeInput): string {
  const { playerName, age, grade, category, targetMonth, stats } = input;
  const monthLabel = `${Number(targetMonth.slice(5, 7))}月`;

  const dailyNotesText =
    input.dailyNotes
      .filter((d) => d.notes && d.notes.trim().length > 0)
      .map((d) => {
        const tags: string[] = [];
        if (d.selfScore !== null) tags.push(`自己採点${d.selfScore}`);
        if (d.fatigueLevel !== null) tags.push(`疲労度${d.fatigueLevel}`);
        if (d.hasPain) tags.push(`痛み: ${d.painLocations.join("・") || "あり"}`);
        return `${d.logDate}（${tags.join(" / ") || "記録なし"}）: ${d.notes}`;
      })
      .join("\n") || "（この月は日誌の自由記述コメントがありません）";

  const matchesText =
    input.matches
      .map((m) => {
        const header = `${m.matchDate} ${m.tournamentName}${m.tournamentGrade ? `(${m.tournamentGrade})` : ""} ${
          m.round ?? ""
        } 対${m.opponentName ?? "不明"} ${m.result === "win" ? "勝ち" : m.result === "lose" ? "負け" : "結果不明"} ${
          m.score ?? ""
        }`;
        const good = m.goodPoints ? `GOOD: ${m.goodPoints}` : "";
        const bad = m.badNextPoints ? `BAD/NEXT: ${m.badNextPoints}` : "";
        return [header, good, bad].filter(Boolean).join("\n");
      })
      .join("\n\n") || "（この月は試合記録がありません）";

  const previous = input.previousReport;
  const previousText = previous
    ? `【前月の技術評価】\n${previous.technicalEvaluation ?? "(なし)"}\n\n【前月のメンタル評価】\n${
        previous.mentalEvaluation ?? "(なし)"
      }\n\n【前月にコーチと合意した今後の技術テーマ】\n${previous.agreedTheme ?? "(なし)"}`
    : "（前月分のレポートはありません。今月が初回、または前月は未作成です）";

  return `あなたはジュニアテニスアカデミーのデータアナリストです。選手の日誌・試合記録をもとに、保護者・選手本人・コーチが読む月次レポートの文章パートを作成してください。

# 選手情報
- 氏名: ${playerName}
- 年齢/学年: ${age !== null ? `満${age}歳` : "不明"} ${grade ?? ""}
- カテゴリ: ${category ?? "不明"}
- 対象月: ${monthLabel}（${targetMonth.slice(0, 7)}）

# 今月の客観的集計データ
- 練習ノート入力日数: ${stats.loggedDays}日
- 試合報告数: ${stats.matchCount}試合
- 平均睡眠時間: ${stats.avgSleepHours ?? "-"}時間
- 平均疲労度: ${stats.avgFatigueLevel ?? "-"}/10
- 平均自己採点: ${stats.avgSelfScore ?? "-"}/10
- 痛みの記録: ${stats.painDays.length}日（${stats.painDays.map((p) => `${p.date}: ${p.locations.join("・")}`).join(", ") || "なし"}）

# 選手が今月書いた日誌の自由記述コメント（自己採点・疲労度・痛み付き）
${dailyNotesText}

# 今月の試合記録（GOOD/BADコメント付き）
${matchesText}

# 前月までのレポート内容（今月とのつながりを書くために参照する）
${previousText}

# 出力してほしい3つの項目

1. technicalEvaluation（技術・戦術面の記録・事実ベース）
   選手が日誌・試合記録に書いた具体的な言葉（フォームの意識、技術的な気づきなど）を拾い、
   事実ベースで技術的な成長・課題を解説する。「●見出し」＋本文、という箇条書き形式を
   2〜3項目、改行区切りのプレーンテキストで書く（マークダウンのアスタリスク等は使わない）。

2. mentalEvaluation（メンタル・取り組み姿勢の記録）
   自己採点の傾向、粘り強さ、言語化能力、モチベーションなど、日誌のコメントから読み取れる
   姿勢・取り組み方を解説する。同様に「●見出し」＋本文を2〜3項目、改行区切りのプレーンテキスト。

3. connectText（CONNECT：技術の繋がり・因果関係の分析）
   前月までのテーマ・評価と、今月の技術習得・試合結果がどう繋がったかを1〜2段落で解説する。
   前月分の情報がない場合は、今月単月の中での技術的なつながり（例: 練習で意識したことが
   試合でどう現れたか）を書く。

# 文章のトーン・注意点
- 保護者や選手本人が読んで前向きになれる、客観的かつ専門的（スポーツ科学・発達段階を踏まえた）なトーンで書く。
- 選手が実際に書いていない内容を過度に創作しない。日誌・試合記録に書かれた事実や言葉を根拠にする。
- 日誌のコメントが極端に少ない、またはネガティブな内容が多い月は、無理に美化せず、事実に即して淡々と記述する。
- 「今後の技術テーマ」「今後の決め事・アドバイス」（コーチ自身の考察部分）はここでは書かない。コーチが別途アプリ上で入力する。

# 出力形式
record_report_narrative ツールを呼び出して、3項目をそのまま渡してください。説明文や前置きは不要です。`;
}
