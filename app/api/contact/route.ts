import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contactInquirySchema } from "@/lib/validations/contact";
import {
  sendContactAutoReplyEmail,
  sendContactNotificationEmail,
} from "@/lib/email/contact-notification";

// 製品紹介サイトの「お問い合わせ」フォームから送信された内容を受け取り、
// contact_inquiriesテーブルに保存する公開APIエンドポイント（認証不要）。
// 保存に加えて、Resend経由でinfo@sv-llc.net宛の通知メールと、送信者宛の
// 自動返信メールも送る（lib/email/contact-notification.ts参照）。過去の問い合わせ一覧の
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

  // 通知メール・自動返信メールはあくまで「お知らせ」。データの保存自体は既に
  // 成功しているため、メール送信が失敗してもユーザーには成功として返す（ログにだけ残す）。
  // 片方の失敗がもう片方に影響しないよう、並列に送って結果を個別に見る。
  const inquiry = {
    name: parsed.data.name,
    organizationName: parsed.data.organizationName,
    email: parsed.data.email,
    message: parsed.data.message,
  };
  const [notifyResult, autoReplyResult] = await Promise.allSettled([
    sendContactNotificationEmail(inquiry),
    sendContactAutoReplyEmail(inquiry),
  ]);
  if (notifyResult.status === "rejected") {
    console.error("contact notification email failed:", notifyResult.reason);
  }
  if (autoReplyResult.status === "rejected") {
    console.error("contact auto-reply email failed:", autoReplyResult.reason);
  }

  return NextResponse.json({ ok: true });
}
