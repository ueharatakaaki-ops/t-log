import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleLanding } from "@/lib/auth/role-landing";
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

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // ここに来るのは、招待リンクが無効・期限切れ、または既に一度使用済みの場合。
  // 招待リンクは一度使うとSupabase側の使い捨てトークンが消費されるため、
  // 「一度ログインした後にもう一度同じ招待メールのリンクを開いた」ケースが
  // 一番多い。その場合エラー画面を見せるのではなく、既存のセッションを見て
  // そのまま普段のダッシュボードへ送ってあげる方が親切。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
    return NextResponse.redirect(new URL(getRoleLanding(appUser?.role), request.url));
  }

  // 未ログインで、かつリンクも無効な場合は素直にログイン画面へ
  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
