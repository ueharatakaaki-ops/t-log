// サーバーコンポーネント / Route Handler から使う Supabase クライアント
// RLSはこのクライアント経由のリクエストにも常に適用される（anon keyのみ使用し、
// service_role keyはバッチ処理・移行スクリプト以外では使わない）
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component からの呼び出し時は無視（middlewareでセッション更新される）
          }
        },
      },
    }
  );
}

// 移行スクリプト・管理バッチ専用（RLSをバイパスする）。
// アプリのリクエストハンドラからは絶対に使用しないこと。
export function createAdminClient() {
  return createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
