import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSchoolUsers } from "@/lib/queries/admin-users";

const ROLE_LABEL: Record<string, string> = {
  system_admin: "システム管理者",
  school_admin: "スクール管理者",
  coach: "コーチ",
  player: "選手",
  parent: "保護者",
};

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await getSchoolUsers(admin.schoolId);

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0F2537]">ユーザー管理</h1>
        <Link href="/admin/users/invite" className="h-9 rounded-lg bg-[#0F2537] px-4 text-sm font-semibold leading-9 text-white">
          招待する
        </Link>
      </div>

      <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-[#0F2537]">{u.displayName}</p>
              <p className="text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString("ja-JP")} 登録</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {ROLE_LABEL[u.role] ?? u.role}
            </span>
          </div>
        ))}
        {users.length === 0 && <p className="p-4 text-sm text-slate-400">まだユーザーがいません</p>}
      </div>

      <Link href="/admin/links" className="mt-4 inline-block text-sm font-semibold text-[#00A859]">
        選手⇔保護者／コーチの紐付け管理へ →
      </Link>
    </main>
  );
}
