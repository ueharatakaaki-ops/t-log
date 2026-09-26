import Link from "next/link";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY_MARKDOWN } from "@/lib/legal/privacy-content";

// ログイン不要で読めるページ（middleware.ts の PUBLIC_PATHS に登録済み）。
export const metadata = {
  title: "プライバシーポリシー | t-log",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
        <LegalDocument markdown={PRIVACY_MARKDOWN} />
        <div className="mt-8 border-t border-slate-100 pt-4 text-center">
          <Link href="/" className="text-sm font-medium text-[#0F2537] underline">
            トップページに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
