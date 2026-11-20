"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; match: string[]; icon: (active: boolean) => ReactNode };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ITEMS: Item[] = [
  {
    href: "/home",
    label: "홈",
    match: ["/home"],
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...(a ? { fill: "currentColor" } : stroke)}>
        <path d="M4 10.5l8-6.5 8 6.5V20H14v-5h-4v5H4z" />
      </svg>
    ),
  },
  {
    href: "/map",
    label: "지도",
    match: ["/map"],
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" {...(a ? { fill: "currentColor" } : stroke)} />
        <path d="M9 4v14M15 6v14" stroke={a ? "#ffffff" : "currentColor"} strokeWidth={a ? 1.4 : 1.6} />
      </svg>
    ),
  },
  {
    href: "/lists",
    label: "리스트",
    match: ["/lists"],
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...(a ? { fill: "currentColor" } : stroke)}>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
    ),
  },
  {
    href: "/settings/accounts",
    label: "MY",
    match: ["/settings"],
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" {...(a ? { fill: "currentColor" } : stroke)} />
        <path d="M4 21c1-4 4-6 8-6s7 2 8 6" {...stroke} />
      </svg>
    ),
  },
];

// 로그인 뒤 큰 화면(홈 · 지도 · 리스트 · MY) 아래에 공통으로
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="하단 메뉴" className="grid h-15 shrink-0 grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      {ITEMS.map((item) => {
        const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-caption ${active ? "font-bold text-ink" : "text-muted"}`}
          >
            {item.icon(active)}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
