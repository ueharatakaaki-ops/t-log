import { z } from "zod";

export const tournamentScheduleSchema = z.object({
  tournamentName: z.string().min(1, "大会名を入力してください").max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です"),
  // 終了日は任意項目。フォーム未入力時は ""、クライアントの実装によっては null や
  // undefined でも送られてくるため、そのいずれも「未入力」としてnullに正規化してから
  // 日付形式を検証する（以前は null が来た場合にどの分岐にも一致せず、汎用的な
  // "Invalid input" というメッセージで登録自体が失敗してしまっていた）。
  endDate: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "終了日の形式が不正です"), z.null()])
  ),
  venue: z.string().max(200).optional().default(""),
  surface: z.enum(["omni", "clay", "hard", "indoor"]).optional().nullable(),
});

export type TournamentScheduleInput = z.infer<typeof tournamentScheduleSchema>;

export const SURFACE_OPTIONS = [
  { value: "omni", label: "オムニ" },
  { value: "clay", label: "クレー" },
  { value: "hard", label: "ハード" },
  { value: "indoor", label: "インドア(カーペット)" },
] as const;
