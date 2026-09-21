import Link from "next/link";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS_MARKDOWN } from "@/lib/legal/terms-content";

// ログイン不要で読めるページ（middleware.ts の PUBLIC_PATHS に登録済み）。
// 初回パスワード設定画面での同意チェックボックスや、ログイン画面から
// 参照できるようにするため、認証の有無に関わらず表示する。
export const metadata = {
  title: "利用規約 | t-log",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
        <LegalDocument markdown={TERMS_MARKDOWN} />
        <div className="mt-8 border-t border-slate-100 pt-4 text-center">
          <Link href="/login" className="text-sm font-medium text-[#0F2537] underline">
            ログイン画面に戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
