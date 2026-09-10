import { LoginForm } from "@/components/auth/LoginForm";

// 招待リンクが無効・期限切れ、または既に使用済みだった場合に
// app/auth/confirm/route.ts・app/auth/callback/route.ts からここへ
// ?error=invalid_link 付きで飛ばされてくる。
const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "リンクの有効期限が切れているか、既に使用済みです。お手数ですが再度お問い合わせください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError = error ? ERROR_MESSAGES[error] ?? null : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F8] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#0F2537]">t-log</h1>
        <p className="mb-8 text-center text-sm text-slate-500">NLTC Junior Team</p>

        <LoginForm initialError={initialError} />

        <p className="mt-6 text-center text-xs text-slate-400">
          アカウントはスクール管理者からの招待メールで発行されます。
          初めての方は招待メール内のリンクからパスワードを設定してください。
        </p>
      </div>
    </main>
  );
}
