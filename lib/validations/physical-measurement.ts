import { z } from "zod";

export const DOMINANT_HAND_OPTIONS = [
  { value: "right", label: "右利き" },
  { value: "left", label: "左利き" },
] as const;

function optionalNumber(max: number, message = "値を確認してください") {
  return z.number().min(0, message).max(max, message).nullable();
}

export const physicalMeasurementSchema = z.object({
  measuredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です"),
  heightCm: optionalNumber(250, "身長の値を確認してください"),
  weightKg: optionalNumber(200, "体重の値を確認してください"),
  eyesightLeft: optionalNumber(2.5, "視力の値を確認してください"),
  eyesightRight: optionalNumber(2.5, "視力の値を確認してください"),
  gripStrengthLeft: optionalNumber(100, "握力の値を確認してください"),
  gripStrengthRight: optionalNumber(100, "握力の値を確認してください"),
  dominantHand: z.enum(["right", "left"]).nullable().default(null),
  racket: z.string().max(100).optional().default(""),
  shoes: z.string().max(100).optional().default(""),
  strings: z.string().max(100).optional().default(""),
});

export type PhysicalMeasurementInput = z.infer<typeof physicalMeasurementSchema>;
