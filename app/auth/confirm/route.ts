import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * 招待メール・パスワードリセットメールの正式な受け皿。
 *
 * Supabaseのメールテンプレートのデフォルト（{{ .ConfirmationURL }}）は、
 * 認証情報をURLの#以降（フラグメント）に埋め込む方式で、フラグメントは
 * サーバーに送られないため、サーバーコンポーネントで検知できずログイン画面に
 * 弾かれてしまう。
 *
 * token_hash方式（?token_hash=...&type=...というクエリパラメータ）であれば
 * サーバー側で受け取れるため、こちらの方式に統一する。
 * Supabaseダッシュボードのメールテンプレート側も、このURLを指す形に
 * 変更する必要がある（手順は別途案内）。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/auth/set-password";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // トークンが無効・期限切れ等の場合はログイン画面へ
  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
