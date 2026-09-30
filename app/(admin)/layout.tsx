import { BottomNav } from "@/components/nav/BottomNav";
import { TopBar } from "@/components/nav/TopBar";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // school_admin/system_adminのどちらでも(admin)配下の画面には入れるが、
  // 全スクール横断の「スクール一覧」タブは system_admin にのみ見せる。
  // システム管理者であることが一目でわかるよう、表示する場合は先頭に置く。
  const admin = await requireAdmin();

  const navItems = [
    ...(admin.role === "system_admin" ? [{ href: "/admin/schools", label: "スクール一覧" }] : []),
    { href: "/admin/users", label: "ユーザー管理" },
    { href: "/admin/links", label: "紐付け管理" },
    { href: "/dashboard", label: "コーチ画面" },
  ];

  return (
    <>
      <TopBar />
      <div className="pb-16">{children}</div>
      <BottomNav items={navItems} />
    </>
  );
}
