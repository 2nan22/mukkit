"use client";

import Link from "next/link";
import { useState } from "react";

// 필수 동의 항목 — 전체 동의 + 항목마다 [필수] · 보기 (국내 앱 가입 화면 형식, 70-6)
// 항목마다 agree_<항목> 이름으로 보내고, 받을 항목 목록은 agree_items 로 — 서버가 항목마다 확인 (JS 없이도 정확)
const ITEMS = {
  age: { label: "[필수] 만 14세 이상입니다" },
  terms: { label: "[필수] 서비스 이용약관 동의", href: "/terms", name: "서비스 이용약관" },
  privacy: { label: "[필수] 개인정보 수집 및 이용 동의", href: "/privacy", name: "개인정보 수집 및 이용" },
} as const;

export type AgreeItem = keyof typeof ITEMS;
type Item = AgreeItem;

export function AgreeCheck({ items = ["age", "terms", "privacy"] }: { items?: Item[] }) {
  const [checked, setChecked] = useState<Set<Item>>(new Set());
  const all = items.every((i) => checked.has(i));
  const toggle = (i: Item) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <div className="flex flex-col rounded-[14px] bg-surface px-4 py-1">
      <input type="hidden" name="agree_items" value={items.join(",")} />
      <label className="flex items-center gap-2.5 border-b border-line py-3.5">
        <input
          type="checkbox"
          checked={all}
          onChange={() => setChecked(all ? new Set() : new Set(items))}
          className="size-5 shrink-0 accent-ink"
        />
        <span className="text-body font-bold">전체 동의</span>
      </label>
      <ul className="flex flex-col py-1.5">
        {items.map((i) => {
          const item: { label: string; href?: string; name?: string } = ITEMS[i];
          return (
            <li key={i} className="flex items-center gap-2.5 py-2">
              <label className="flex min-w-0 flex-1 items-center gap-2.5">
                <input type="checkbox" name={`agree_${i}`} required checked={checked.has(i)} onChange={() => toggle(i)} className="size-5 shrink-0 accent-ink" />
                <span className="text-meta text-ink-2">{item.label}</span>
              </label>
              {item.href && (
                // 새 탭으로 — 돌아왔을 때 체크 · 입력한 닉네임이 풀리지 않게
                <Link
                  href={item.href}
                  target="_blank"
                  aria-label={`${item.name} 보기`}
                  className="-my-2 shrink-0 px-2 py-3 text-caption text-muted underline underline-offset-2"
                >
                  보기
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
