import { z } from "zod";

export const ROUNDS = [
  { value: "qualifying", label: "予選" },
  { value: "r1", label: "1R" },
  { value: "r2", label: "2R" },
  { value: "qf", label: "QF" },
  { value: "sf", label: "SF" },
  { value: "f", label: "F" },
  { value: "placement", label: "順位戦" },
  { value: "practice", label: "練習試合" },
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
  round: z.enum(["qualifying", "r1", "r2", "qf", "sf", "f", "placement", "practice"]),
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
