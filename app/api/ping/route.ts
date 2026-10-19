import { NextResponse } from "next/server";

// 疎通確認用（lib/client/resilient-post.ts の pingConnection から呼ぶ）。
// モバイル回線で切れたままの接続を、送信前に作り直させるきっかけにする。
// 認証不要。個人情報は返さない。
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
