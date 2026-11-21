"use client";

import { useState } from "react";
import type { Menu } from "./menu";

const SHOWN = 6;

function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

export function MenuSection({ menu, kakaoUrl }: { menu: Menu; kakaoUrl: string }) {
  const [all, setAll] = useState(false);
  const items = all ? menu.items : menu.items.slice(0, SHOWN);
  return (
    <section className="flex flex-col border-b-8 border-surface px-5 pt-4 pb-4">
      <h2 className="text-section font-bold">메뉴</h2>
      <ul className="pt-1">
        {items.map((m, i) => (
          <li key={`${m.name}-${i}`} className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-b-0">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="text-body">{m.name}</span>
                {m.recommended && <span className="rounded bg-tier-3-soft px-1.5 text-caption font-bold text-tier-3">대표</span>}
              </span>
              {m.description && <span className="text-meta text-muted">{m.description}</span>}
            </span>
            <span className="shrink-0 text-body font-semibold tabular-nums">{m.price ? won(m.price) : "변동"}</span>
          </li>
        ))}
      </ul>
      {menu.items.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="flex h-10 items-center justify-center gap-1 text-meta font-medium text-muted">
          {all ? "접기" : `메뉴 ${menu.items.length}개 모두 보기`}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={all ? "rotate-180" : ""} aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
      <p className="pt-3 text-caption leading-normal text-muted">
        카카오맵 기준{menu.updatedAt ? ` · ${menu.updatedAt.slice(0, 10).replaceAll("-", ".")} 갱신` : ""} · 가격은 바뀔 수 있어요.{" "}
        <a href={kakaoUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          카카오맵에서 보기
        </a>
      </p>
    </section>
  );
}
