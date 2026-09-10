// 全リクエストでSupabaseセッションを更新し、未ログイン時はロールごとの
// ログイン画面へリダイレクトする
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/confirm"];

export async function middleware(request: NextRequest) {
  // Supabaseがセッションを更新（トークンのリフレッシュ）した際、
  // request.cookies にも反映してからレスポンスを作り直すことで、
  // 更新後のCookieが確実にブラウザへ返るようにする
  // （公式に推奨されている書き方。以前のget/set/remove方式は
  // 大きいセッションCookieが複数に分割される際に更新が引き継がれず、
  // クリックのたびにログアウトしたように見える不具合の原因になっていた）
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "/" は完全一致のみ公開扱いにする（startsWithだと全ページが"/"にマッチしてしまうため）
  const isRoot = request.nextUrl.pathname === "/";
  const isPublicPath = isRoot || PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  // /api配下（cronのBearer認証など、独自の認証方式を持つAPIルート）は
  // このmiddlewareの対象から除外する。除外しないと未ログイン扱いで
  // 常に/loginへリダイレクトされてしまい、Vercel Cronからの呼び出しが
  // 到達できなくなる（実際にmonthly-reportsのcronがこれで失敗していた）。
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
