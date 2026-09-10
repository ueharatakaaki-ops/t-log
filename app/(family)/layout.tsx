import { requireFamily } from "@/lib/auth/require-family";
import { BottomNav } from "@/components/nav/BottomNav";
import { PLAYER_NAV_ITEMS } from "@/lib/nav/player-nav";

const PARENT_NAV = [
  { href: "/reports", label: "月次レポート" },
  { href: "/history", label: "過去ログ" },
];

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireFamily();
  const items = ctx.role === "player" ? PLAYER_NAV_ITEMS : PARENT_NAV;

  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomNav items={items} />
    </>
  );
}
