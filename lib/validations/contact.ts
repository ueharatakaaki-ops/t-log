import { z } from "zod";

// 製品紹介サイトの「お問い合わせ」フォーム用のバリデーション。
// honeypotはボット対策用の隠しフィールド（人間の入力者には見えない想定で、
// 埋まっていた場合はスパムとして扱い、フォーム側には成功したように見せる）。
export const contactInquirySchema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください").max(100, "お名前が長すぎます"),
  organizationName: z
    .string()
    .trim()
    .min(1, "スクール名・団体名を入力してください")
    .max(200, "スクール名・団体名が長すぎます"),
  email: z.string().trim().min(1, "メールアドレスを入力してください").email("メールアドレスの形式が正しくありません"),
  message: z.string().trim().min(1, "お問い合わせ内容を入力してください").max(4000, "お問い合わせ内容が長すぎます"),
  honeypot: z.string().optional(),
});

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;
