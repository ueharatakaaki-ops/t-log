import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// 日次ログ送信の経過（結果・各試行・きっかけ）を記録する（「送信できなかった」報告の原因確認用）。
// ログイン中の本人だけが、本人のセッション（RLS あり）で自分の行を書き込む（0014_client_submit_logs.sql）。
// 日次ログの入力内容は受け取らない（スキーマにない項目は捨てる）。
//
// テーブル適用前は CLIENT_LOG_ENABLED を設定せず、何も保存しない。
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;
// 1人あたりの1分間の上限（同一サーバーインスタンス内での目安。RLS で本人の行しか書けないため、これは量の抑制だけ）
const MAX_EVENTS_PER_USER_PER_MINUTE = 20;

const attemptSchema = z.object({
  n: z.number().int().min(1).max(10),
  ms: z.number().int().min(0).max(600_000),
  result: z.string().regex(/^(ok|timeout|network_error|http_\d{3})$/),
});

const payloadSchema = z.object({
  kind: z.literal("daily_log"),
  outcome: z.enum(["ok", "http_error", "gave_up"]),
  httpStatus: z.number().int().min(0).max(999).optional(),
  attempts: z.array(attemptSchema).max(10),
  trigger: z.enum(["button", "online", "visible"]),
  online: z.boolean().optional(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const recent = new Map<string, number[]>();

function overUserLimit(userId: string, now: number): boolean {
  const times = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  times.push(now);
  recent.set(userId, times);
  if (recent.size > 5000) recent.clear();
  return times.length > MAX_EVENTS_PER_USER_PER_MINUTE;
}

export async function POST(request: Request) {
  if (process.env.CLIENT_LOG_ENABLED !== "1") {
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (overUserLimit(user.id, Date.now())) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const { data: appUser } = await supabase.from("app_users").select("school_id").eq("id", user.id).single();
  if (!appUser) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const d = parsed.data;
  const { error } = await supabase.from("client_submit_logs").insert({
    school_id: appUser.school_id,
    user_id: user.id,
    kind: d.kind,
    outcome: d.outcome,
    http_status: d.httpStatus ?? null,
    attempts: d.attempts,
    trigger: d.trigger,
    online: d.online ?? null,
    log_date: d.logDate ?? null,
    user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200) || null,
  });
  if (error) {
    console.error("client_submit_logs insert failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
