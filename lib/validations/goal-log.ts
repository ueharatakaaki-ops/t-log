import { z } from "zod";

export const goalLogSchema = z.object({
  targetMonth: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, "対象月の形式が不正です"), // 月初日 (YYYY-MM-01) に正規化して保存
  technicalGoal: z.string().min(1, "今期の強化テーマを入力してください").max(500),
  physicalGoal: z.string().min(1, "フィジカル・生活の目標を入力してください").max(500),
  actionPlan: z.string().min(1, "アクションプランを入力してください").max(500),
});

export type GoalLogInput = z.infer<typeof goalLogSchema>;

/** <input type="month"> の "YYYY-MM" を DBの月初日 "YYYY-MM-01" に変換する */
export function monthInputToTargetMonth(monthValue: string): string {
  return `${monthValue}-01`;
}
