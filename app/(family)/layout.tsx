import { requireFamily } from "@/lib/auth/require-family";
import { BottomNav } from "@/components/nav/BottomNav";

const PLAYER_NAV = [
  { href: "/daily-log", label: "Daily" },
  { href: "/match-log", label: "Match" },
  { href: "/goal-log", label: "Goal" },
  { href: "/schedule", label: "大会予定" },
  { href: "/history", label: "履歴" },
  { href: "/reports", label: "レポート" },
];

const PARENT_NAV = [
  { href: "/reports", label: "月次レポート" },
  { href: "/history", label: "過去ログ" },
];

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireFamily();
  const items = ctx.role === "player" ? PLAYER_NAV : PARENT_NAV;

  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomNav items={items} />
    </>
  );
}
