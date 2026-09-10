import { BottomNav } from "@/components/nav/BottomNav";
import { PLAYER_NAV_ITEMS } from "@/lib/nav/player-nav";

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomNav items={PLAYER_NAV_ITEMS} />
    </>
  );
}
