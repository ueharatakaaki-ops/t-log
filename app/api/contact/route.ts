import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contactInquirySchema } from "@/lib/validations/contact";
import { sendContactNotificationEmail } from "@/lib/email/contact-notification";

// 製品紹介サイトの「お問い合わせ」フォームから送信された内容を受け取り、
// contact_inquiriesテーブルに保存する公開APIエンドポイント（認証不要）。
// 保存に加えて、Resend経由でinfo@sv-llc.net宛に通知メールも送る
// （lib/email/contact-notification.ts参照）。過去の問い合わせ一覧の
// 閲覧はSupabaseダッシュボードのテーブルエディタから行う想定
// （0012マイグレーション参照）。
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  const parsed = contactInquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" },
      { status: 400 }
    );
  }

  // ボット対策の隠しフィールドが埋まっている場合は、保存せず成功したように返す
  // （ボットに「弾かれた」ことを気づかせないため）。
  if (parsed.data.honeypot) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_inquiries").insert({
    name: parsed.data.name,
    organization_name: parsed.data.organizationName,
    email: parsed.data.email,
    message: parsed.data.message,
  });

  if (error) {
    console.error("contact_inquiries insert failed:", error.message);
    return NextResponse.json(
      { ok: false, error: "送信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }

  // 通知メールはあくまで「お知らせ」。データの保存自体は既に成功しているため、
  // メール送信が失敗してもユーザーには成功として返す（ログにだけ残す）。
  try {
    await sendContactNotificationEmail({
      name: parsed.data.name,
      organizationName: parsed.data.organizationName,
      email: parsed.data.email,
      message: parsed.data.message,
    });
  } catch (notifyError) {
    console.error("contact notification email failed:", notifyError);
  }

  return NextResponse.json({ ok: true });
}
