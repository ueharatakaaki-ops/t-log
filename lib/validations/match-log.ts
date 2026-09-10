import { z } from "zod";

// ラウンドは「区分（予選/本戦/順位別トーナメント/練習試合）」と
// 「回戦（1R/2R/…/F）」の組み合わせで表現する（例: 「予選 1R」「本戦 QF」）。
// 以前は「予選」「1R」等をひとつのフラットな選択肢から1つだけ選ぶ形だったが、
// 実際の大会は「予選1R」「本戦2R」のように両方の情報が必要なため分離した。
// 練習試合のみ回戦の概念が無いため区分だけで完結する。
export const ROUND_CATEGORIES = [
  { value: "qualifying", label: "予選" },
  { value: "main", label: "本戦" },
  { value: "placement", label: "順位別トーナメント" },
  { value: "practice", label: "練習試合" },
] as const;

export const ROUND_STAGES = [
  { value: "r1", label: "1R" },
  { value: "r2", label: "2R" },
  { value: "r3", label: "3R" },
  { value: "qf", label: "QF" },
  { value: "sf", label: "SF" },
  { value: "f", label: "F" },
] as const;

export const SURFACES = [
  { value: "omni", label: "オムニ" },
  { value: "clay", label: "クレー" },
  { value: "hard", label: "ハード" },
  { value: "indoor", label: "インドア(カーペット)" },
] as const;

export const RESULTS = [
  { value: "win", label: "勝ち" },
  { value: "lose", label: "負け" },
] as const;

export const matchLogSchema = z.object({
  matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です"),
  tournamentName: z.string().min(1, "大会名を入力してください").max(200),
  tournamentGrade: z.string().max(100).optional().default(""),
  // UI側で区分+回戦（例:「予選 1R」）または「練習試合」に組み立て済みの文字列を渡す
  round: z.string().min(1, "ラウンドを選択してください").max(50),
  opponentName: z.string().max(200).optional().default(""),
  opponentClub: z.string().max(200).optional().default(""),
  result: z.enum(["win", "lose"]),
  score: z.string().max(100).optional().default(""),
  surface: z.enum(["omni", "clay", "hard", "indoor"]),
  goodPoints: z.string().min(1, "良かった点を入力してください").max(500),
  badNextPoints: z.string().min(1, "課題・次への対策を入力してください").max(500),
  tournamentScheduleId: z.string().uuid().optional().nullable(),
});

export type MatchLogInput = z.infer<typeof matchLogSchema>;
