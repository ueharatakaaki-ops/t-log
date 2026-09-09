/**
 * 移行スクリプト専用のSupabaseクライアント。
 * service_role キーでRLSをバイパスするため、必ずCLIから手動実行し、
 * アプリケーションコードから呼び出さないこと。
 *
 * 実行前に環境変数を設定:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数に設定してから実行してください"
  );
}

export const adminClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

/** NLTCのschool_idを取得する（移行対象は現状NLTC1校のみのため決め打ちで取得） */
export async function getNltcSchoolId(): Promise<string> {
  const { data, error } = await adminClient.from("schools").select("id").eq("slug", "nltc").single();
  if (error || !data) {
    throw new Error("NLTCのスクールレコードが見つかりません。0001マイグレーションの初期データ投入を確認してください");
  }
  return data.id;
}
