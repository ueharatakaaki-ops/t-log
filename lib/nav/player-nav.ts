import type { NavItem } from "@/components/nav/BottomNav";

// 選手ロールの下部ナビゲーション。app/(player)/layout.tsx と
// app/(family)/layout.tsx（選手本人がログインした場合）の両方から使われる。
// ページ自体は(player)グループと(family)グループに分かれて実装されているが、
// 選手から見れば1つのアプリなので、タブの並びは常に同じにする必要がある
// （以前、2箇所に別々の配列を持っていたため、画面によって「レポート」タブの
// 有無が変わってしまう不具合があった）。
export const PLAYER_NAV_ITEMS: NavItem[] = [
  { href: "/daily-log", label: "Daily" },
  { href: "/match-log", label: "Match" },
  { href: "/goal-log", label: "Goal" },
  { href: "/schedule", label: "大会予定" },
  { href: "/history", label: "履歴" },
  { href: "/reports", label: "レポート" },
];
