import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleLanding } from "@/lib/auth/role-landing";

// Route Handlerはlayoutのdynamic設定を継承しないため、ここでも明示しておく
// （searchParamsを読む時点で通常は動的判定されるが、明示しておくのが安全）
export const dynamic = "force-dynamic";

/**
 * 招待メール・パスワードリセットメール内のリンクの受け皿（?code=...形式）。
 * 現在はapp/auth/confirm/route.tsのtoken_hash方式に統一済みだが、
 * 過去に送信済みの招待メールや、設定変更前のメールテンプレートが
 * まだこちらの形式を指している可能性があるため残してある。
 *
 * 招待リンクは一度使うと使い捨てコードが消費されるため、以前一度
 * 使用済みのリンクをもう一度開かれるケースがある。その場合は
 * エラー画面を出さず、既存のセッションがあればそのままダッシュボードへ、
 * 未ログインならエラー付きでログイン画面へ送る。
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/auth/set-password", request.url));
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
    return NextResponse.redirect(new URL(getRoleLanding(appUser?.role), request.url));
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
