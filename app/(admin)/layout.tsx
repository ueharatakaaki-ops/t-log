import { BottomNav } from "@/components/nav/BottomNav";

const ADMIN_NAV = [
  { href: "/admin/users", label: "ユーザー管理" },
  { href: "/admin/links", label: "紐付け管理" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomNav items={ADMIN_NAV} />
    </>
  );
}
