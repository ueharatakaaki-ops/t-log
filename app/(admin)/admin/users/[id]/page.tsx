import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getUserDetail } from "@/lib/queries/admin-users";
import { EditUserRoleForm } from "@/components/admin/EditUserRoleForm";
import { EditPlayerBirthdateForm } from "@/components/admin/EditPlayerBirthdateForm";
import { SendPasswordResetButton } from "@/components/admin/SendPasswordResetButton";

const ROLE_LABEL: Record<string, string> = {
  system_admin: "システム管理者",
  school_admin: "スクール管理者",
  coach: "コーチ",
  player: "選手",
  parent: "保護者",
};

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await getUserDetail(id, admin.schoolId);

  if (!user) notFound();

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">{user.displayName}</h1>
      <p className="mb-6 text-sm text-slate-500">
        現在のロール：{ROLE_LABEL[user.role] ?? user.role}
      </p>

      <div className="mb-6 flex flex-col gap-4">
        {["coach", "school_admin"].includes(user.role) ? (
          <EditUserRoleForm user={user} />
        ) : user.role === "player" ? (
          <EditPlayerBirthdateForm user={user} />
        ) : (
          <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
            保護者・システム管理者のロールは、この画面からは変更できません。
          </p>
        )}
      </div>

      <SendPasswordResetButton userId={user.id} displayName={user.displayName} />
    </main>
  );
}
