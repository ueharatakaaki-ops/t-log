import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveDailyLog, type SaveDailyLogFailureReason } from "@/lib/daily-log/save";

// Daily Log の送信先。画面（components/daily-log/DailyLogForm.tsx）は、
// lib/client/resilient-post.ts の再試行つき fetch でここへ POST する。
// Server Action と違い、クライアント側で「打ち切り→自動再試行」ができるようにするためのもの。
//
// middleware.ts の matcher は /api を除外しているため、認証はこのハンドラー内で行う
// （saveDailyLog の中で createClient → getUser）。期限切れのアクセストークンは
// getUser の中で自動更新され、更新後の Cookie は cookies().set 経由でこのレスポンスに付く。
// 未ログインはリダイレクトせず 401 の JSON を返す（fetch がログイン画面のHTMLを受け取らないように）。

export const dynamic = "force-dynamic";

const STATUS_BY_REASON: Record<SaveDailyLogFailureReason, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  deadline: 409,
  save_failed: 500,
};

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "リクエストの形式が正しくありません" },
      { status: 400, headers: NO_STORE }
    );
  }

  const supabase = await createClient();
  const result = await saveDailyLog(supabase, body);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, fieldErrors: result.fieldErrors },
      { status: STATUS_BY_REASON[result.reason], headers: NO_STORE }
    );
  }

  revalidatePath("/daily-log");
  revalidatePath("/history");
  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
