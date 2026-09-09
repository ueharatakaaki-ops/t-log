import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Route Handlerはlayoutのdynamic設定を継承しないため、ここでも明示しておく
// （searchParamsを読む時点で通常は動的判定されるが、明示しておくのが安全）
export const dynamic = "force-dynamic";

/**
 * 招待メール・パスワードリセットメール内のリンクの受け皿。
 * ?code=... を受け取り、セッションを確立したうえでパスワード設定画面へ送る。
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/auth/set-password", request.url));
}
