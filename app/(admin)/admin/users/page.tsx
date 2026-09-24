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

  // ロール別の登録人数（「コーチが今何人いるか」等がひと目で分かるように）
  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});
  const adminCount = (counts.school_admin ?? 0) + (counts.system_admin ?? 0);

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0F2537]">ユーザー管理</h1>
        <Link href="/admin/users/invite" className="h-9 rounded-lg bg-[#0F2537] px-4 text-sm font-semibold leading-9 text-white">
          招待する
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        <CountCell label="選手" value={counts.player ?? 0} />
        <CountCell label="コーチ" value={counts.coach ?? 0} />
        <CountCell label="保護者" value={counts.parent ?? 0} />
        <CountCell label="管理者" value={adminCount} />
      </div>

      <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
        {/* 全ロールとも、この詳細画面からパスワード再設定メールを送れるようにするため、
            ロールに関わらず全員分クリック可能にしている（以前は保護者・システム管理者は
            編集画面が無いという理由でクリック不可にしていたが、それだとパスワードを
            忘れた保護者に再設定メールを送る手段が無かった） */}
        {users.map((u) => (
          <Link
            key={u.id}
            href={`/admin/users/${u.id}`}
            className="flex items-center justify-between p-4 active:bg-[#F4F6F8]"
          >
            <div>
              <p className="font-semibold text-[#0F2537]">{u.displayName}</p>
              <p className="text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString("ja-JP")} 登録</p>
            </div>
            <div className="flex items-center gap-2">
              {u.birthdateMissing && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  生年月日未入力
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {ROLE_LABEL[u.role] ?? u.role}
              </span>
            </div>
          </Link>
        ))}
        {users.length === 0 && <p className="p-4 text-sm text-slate-400">まだユーザーがいません</p>}
      </div>

      <Link href="/admin/links" className="mt-4 inline-block text-sm font-semibold text-[#00A859]">
        選手⇔保護者／コーチの紐付け管理へ →
      </Link>
    </main>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white py-2">
      <p className="text-lg font-bold text-[#0F2537]">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
