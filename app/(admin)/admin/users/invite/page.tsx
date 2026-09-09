import { requireAdmin } from "@/lib/auth/require-admin";
import { InviteUserForm } from "@/components/admin/InviteUserForm";

export default async function InviteUserPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">ユーザーを招待</h1>
      <p className="mb-6 text-sm text-slate-500">
        招待メールが送信され、選手・コーチ・保護者本人がパスワードを設定して初回ログインします。
      </p>
      <InviteUserForm />
    </main>
  );
}
