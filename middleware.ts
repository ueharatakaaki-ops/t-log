// 全リクエストでSupabaseセッションを更新し、未ログイン時はロールごとの
// ログイン画面へリダイレクトする
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /auth/code: メールのリンクが開けない人が、確認コードで登録・再設定を続ける画面（未ログインで開く）。
// /api 配下は matcher で除外しているため、ここには書かない（各ルートが自前で認証する）。
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/confirm", "/auth/code", "/terms", "/privacy"];

// 完全一致か、その配下（"/auth/code/..."）だけを公開扱いにする。
// 単純な startsWith だと "/auth/codex" のような別のパスまで公開扱いになってしまう。
function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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
  const isPublicPath = isRoot || isPublic(request.nextUrl.pathname);

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
  // 画像ファイル（public/logo.pngなど）も除外する。除外しないと未ログイン時に
  // /loginへリダイレクトされ、ログイン画面のロゴ自体が表示できなくなる。
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
