import type { Metadata } from "next";
import "./globals.css";

// このアプリは「静的なマーケティングページ」を一切持たず、全ページが
// Supabaseの認証情報（cookies経由のセッション）に依存する。
// ここでforce-dynamicを指定すると、配下の全ルート（page.tsx）に設定が
// 継承され、ビルド時の静的プリレンダリングを試みなくなる。
// これにより、ビルド環境でNEXT_PUBLIC_SUPABASE_URL等が未解決のまま
// createServerClient()が実行されて例外になる、という失敗パターンを避けられる。
// (Route Handler単体には継承されないため、app/auth/callback/route.ts側にも
//  個別に付与している。詳細はそちらのコメント参照)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "t-log",
  description: "NLTC Junior Team コンディション管理アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
