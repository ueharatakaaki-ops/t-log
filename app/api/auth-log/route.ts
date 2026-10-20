import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

// 招待・再設定リンク（/auth/confirm）とコード入力（/auth/code）の診断情報を記録する（次回の原因確定用）。
// ログイン前のページから送るため認証不要（/api 配下は middleware の対象外）。
//
// 保存するのは診断情報だけ: イベント種別・token_hash の長さと形式・next の有無・アプリ内ブラウザの種類・
// エラーの name/status/code・UA の先頭200文字・時刻。
// メールアドレス・token_hash・URL・IP は受け取らず保存もしない（スキーマにない項目は捨てる）。
//
// auth_link_events への書き込みは RLS で service role のみに限定しているため、service role で書く
// （0015_auth_link_events.sql）。テーブル適用前は AUTH_LOG_ENABLED を設定せず、何も保存しない。
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2048;
// 全体での1分あたりの上限（公開エンドポイントのため、大量送信でテーブルが膨らまないようにする）。
// サーバーのインスタンスをまたいだ上限は DB の件数で判定し、同一インスタンス内ではメモリでも先に弾く。
const MAX_EVENTS_PER_MINUTE = 120;

const payloadSchema = z.object({
  event: z.enum(["confirm_view", "confirm_success", "confirm_error", "code_success", "code_error"]),
  hashLength: z.number().int().min(0).max(4096).optional(),
  hashFormatOk: z.boolean().optional(),
  hasNext: z.boolean().optional(),
  inAppBrowser: z
    .enum(["line", "facebook", "instagram", "docomo", "ios-webview", "android-webview"])
    .nullable()
    .optional(),
  errorName: z.string().regex(/^[A-Za-z]{1,64}$/).optional(),
  errorStatus: z.number().int().min(0).max(999).optional(),
  errorCode: z.string().regex(/^[a-z0-9_]{1,64}$/).optional(),
});

let windowStart = 0;
let windowCount = 0;

function overLocalLimit(now: number): boolean {
  if (now - windowStart >= 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount++;
  return windowCount > MAX_EVENTS_PER_MINUTE;
}

export async function POST(request: Request) {
  if (process.env.AUTH_LOG_ENABLED !== "1") {
    return new NextResponse(null, { status: 204 });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (overLocalLimit(Date.now())) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const supabaseAdmin = createAdminClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countError } = await supabaseAdmin
    .from("auth_link_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (countError) {
    console.error("auth_link_events count failed:", countError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_EVENTS_PER_MINUTE) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const d = parsed.data;
  const { error } = await supabaseAdmin.from("auth_link_events").insert({
    event: d.event,
    hash_length: d.hashLength ?? null,
    hash_format_ok: d.hashFormatOk ?? null,
    has_next: d.hasNext ?? null,
    in_app_browser: d.inAppBrowser ?? null,
    error_name: d.errorName ?? null,
    error_status: d.errorStatus ?? null,
    error_code: d.errorCode ?? null,
    user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200) || null,
  });
  if (error) {
    console.error("auth_link_events insert failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
