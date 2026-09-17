import { BottomNav } from "@/components/nav/BottomNav";
import { requireStaff } from "@/lib/auth/require-staff";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  // school_admin/system_adminはこのコーチ用画面にも入れるが、招待画面等は
  // 別セクション(/admin/users)にあるため、行き来できるようタブを1つ足す。
  // coachロールには管理機能を見せないので、このタブは出さない。
  const staff = await requireStaff();

  const navItems = [
    { href: "/dashboard", label: "ダッシュボード" },
    { href: "/players", label: "選手" },
    { href: "/team-schedule", label: "大会予定" },
    { href: "/reports/manage", label: "月次レポート" },
    { href: "/reports/custom", label: "期間集計" },
    ...(staff.role === "school_admin" || staff.role === "system_admin"
      ? [{ href: "/admin/users", label: "管理" }]
      : []),
  ];

  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomNav items={navItems} />
    </>
  );
}
