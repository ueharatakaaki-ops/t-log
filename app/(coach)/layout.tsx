import { BottomNav } from "@/components/nav/BottomNav";

const COACH_NAV = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/players", label: "選手" },
  { href: "/team-schedule", label: "大会予定" },
  { href: "/reports/manage", label: "月次レポート" },
  { href: "/reports/custom", label: "期間集計" },
];

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomNav items={COACH_NAV} />
    </>
  );
}
