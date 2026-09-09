"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/**
 * ロールごとの主要画面への導線をまとめた下部固定ナビゲーション。
 * ページ数が増えてきたため、URLを直接知らなくても行き来できるようにする。
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex-1 py-2.5 text-center text-xs font-semibold",
                isActive ? "text-[#0F2537]" : "text-slate-400",
              ].join(" ")}
            >
              <span
                className={[
                  "mx-auto mb-0.5 block h-1 w-6 rounded-full",
                  isActive ? "bg-[#00A859]" : "bg-transparent",
                ].join(" ")}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
