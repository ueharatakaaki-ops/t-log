import { z } from "zod";

export const PAIN_LOCATIONS = [
  "手首",
  "肘",
  "肩",
  "腰",
  "股関節",
  "膝",
  "足首",
  "足裏",
  "その他",
] as const;

// よく使う気づきフレーズ（タップだけで入力を済ませられるようにするためのクイック選択肢）
export const NOTE_QUICK_PHRASES = [
  "サーブが良かった",
  "切り替えが早くできた",
  "footworkを意識できた",
  "ミスが多かった",
  "集中が続かなかった",
  "体が重かった",
] as const;

export const dailyLogSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です"),
  sleepHours: z
    .number()
    .min(0, "0以上で入力してください")
    .max(14, "14以下で入力してください")
    .multipleOf(0.5, "0.5時間刻みで選択してください"),
  fatigueLevel: z.number().int().min(1).max(10),
  hasPain: z.boolean(),
  painLocations: z.array(z.enum(PAIN_LOCATIONS)).default([]),
  selfScore: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional().default(""),
  coachMessage: z.string().max(500).optional().default(""),
}).refine(
  (data) => !data.hasPain || data.painLocations.length > 0,
  { message: "痛みがある場合は部位を1つ以上選択してください", path: ["painLocations"] }
);

export type DailyLogInput = z.infer<typeof dailyLogSchema>;
