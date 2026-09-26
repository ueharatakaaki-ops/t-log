import { Resend } from "resend";

// 通知メールの送信先・送信元。どちらも秘匿情報ではないためコードに直書きしている。
// 送信元のドメイン（tlog-sports.com）はResend側でドメイン認証済みであることが前提。
const CONTACT_NOTIFICATION_TO = "info@sv-llc.net";
const CONTACT_NOTIFICATION_FROM = "t-log お問い合わせ通知 <notify@tlog-sports.com>";

type ContactInquiry = {
  name: string;
  organizationName: string;
  email: string;
  message: string;
};

/**
 * 製品紹介サイトのお問い合わせフォームから送信された内容を、
 * 通知メールとして CONTACT_NOTIFICATION_TO 宛に送る。
 *
 * データの保存自体（contact_inquiriesテーブルへのinsert）は
 * これとは別に行われており、そちらが本体・こちらは「お知らせ」に
 * すぎない。そのため、ここで例外が発生してもフォーム送信自体は
 * 成功として扱いたい（メール送信の失敗でユーザーに「送信に失敗した」
 * と表示するのは不適切なため）。呼び出し側で必ずtry/catchすること。
 */
export async function sendContactNotificationEmail(inquiry: ContactInquiry) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // ローカル開発環境などでRESEND_API_KEYが未設定の場合は、
    // エラーにはせずスキップするだけにする。
    console.warn(
      "RESEND_API_KEYが未設定のため、お問い合わせの通知メール送信をスキップしました。"
    );
    return;
  }

  const resend = new Resend(apiKey);

  // Resend SDKは送信失敗（ドメイン未認証・APIキー不正など）でも例外を投げず、
  // 戻り値のerrorで返す。呼び出し側のtry/catchでログに残せるよう、ここで投げ直す。
  const { error } = await resend.emails.send({
    from: CONTACT_NOTIFICATION_FROM,
    to: CONTACT_NOTIFICATION_TO,
    replyTo: inquiry.email,
    subject: `【t-log】お問い合わせ: ${inquiry.organizationName} 様`,
    text: [
      "製品紹介サイトのお問い合わせフォームから、新しい問い合わせがありました。",
      "",
      `お名前: ${inquiry.name}`,
      `スクール名・団体名: ${inquiry.organizationName}`,
      `メールアドレス: ${inquiry.email}`,
      "",
      "お問い合わせ内容:",
      inquiry.message,
      "",
      `※このメールにそのまま返信すると、送信者（${inquiry.email}）宛に届きます。`,
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
}
