import { z } from "zod";

export const tournamentScheduleSchema = z.object({
  tournamentName: z.string().min(1, "大会名を入力してください").max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
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
