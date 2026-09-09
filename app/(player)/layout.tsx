import { BottomNav } from "@/components/nav/BottomNav";

const PLAYER_NAV = [
  { href: "/daily-log", label: "Daily" },
  { href: "/match-log", label: "Match" },
  { href: "/goal-log", label: "Goal" },
  { href: "/schedule", label: "大会予定" },
  { href: "/history", label: "履歴" },
];

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomNav items={PLAYER_NAV} />
    </>
  );
}
