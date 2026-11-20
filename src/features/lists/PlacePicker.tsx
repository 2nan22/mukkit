"use client";

import { useMemo, useState } from "react";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { TIER_LABEL, TIERS, type Tier } from "@/domain/tier";
import { SOURCE_LABEL } from "@/features/import/sources";
import type { PickablePlace } from "./pickablePlaces";

type Props = {
  places: PickablePlace[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  initialOrigin?: string;
  exclude?: Set<string>;
};

// 이름 · 주소 · 내 메모 · 원래 리스트 이름 · 원래 메모로 찾고, 원래 리스트 · 등급으로 거른다
export function PlacePicker({ places, selected, onChange, initialOrigin = "", exclude }: Props) {
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState(initialOrigin);
  const [tier, setTier] = useState<Tier | "">("");

  const origins = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const p of places)
      for (const o of p.origins) {
        const cur = m.get(o.listKey) ?? { label: `${SOURCE_LABEL[o.source]} · ${o.listName}`, count: 0 };
        cur.count += 1;
        m.set(o.listKey, cur);
      }
    return [...m.entries()];
  }, [places]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p) => {
      if (exclude?.has(p.placeId)) return false;
      if (origin && !p.origins.some((o) => o.listKey === origin)) return false;
      if (tier && p.tier !== tier) return false;
      if (!q) return true;
      const text = [p.name, p.address, p.note, p.categoryName, ...p.origins.flatMap((o) => [o.listName, o.memo])].join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [places, query, origin, tier, exclude]);

  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.placeId));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function toggleAllShown() {
    const next = new Set(selected);
    for (const p of shown) {
      if (allShownSelected) next.delete(p.placeId);
      else next.add(p.placeId);
    }
    onChange(next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 px-5 pb-2">
        <label htmlFor="pick-q" className="sr-only">
          장소 찾기
        </label>
        <input
          id="pick-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 · 지역 · 메모로 찾기"
          className="h-11 rounded-btn-m border border-line-strong px-3.5 text-body outline-none focus:border-ink"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor="pick-origin">
            원래 리스트
          </label>
          <select
            id="pick-origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="h-11 min-w-0 rounded-btn-m border border-line-strong bg-white px-2.5 text-meta"
          >
            <option value="">원래 리스트 전체</option>
            {origins.map(([key, o]) => (
              <option key={key} value={key}>
                {o.label} ({o.count})
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="pick-tier">
            등급
          </label>
          <select
            id="pick-tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier | "")}
            className="h-11 min-w-0 rounded-btn-m border border-line-strong bg-white px-2.5 text-meta"
          >
            <option value="">등급 전체</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between text-meta">
          <span className="text-muted">
            {shown.length}곳 · <b className="text-ink">{selected.size}곳 고름</b>
          </span>
          <button type="button" onClick={toggleAllShown} disabled={shown.length === 0} className="h-9 font-bold text-ink disabled:text-muted">
            {allShownSelected ? "보이는 곳 빼기" : "보이는 곳 모두 고르기"}
          </button>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-5">
        {shown.map((p) => {
          const memo = p.note || p.origins.find((o) => o.memo)?.memo || "";
          return (
            <li key={p.placeId}>
              <label className="flex min-h-16 cursor-pointer items-center gap-3 border-b border-line py-2">
                <input
                  type="checkbox"
                  checked={selected.has(p.placeId)}
                  onChange={() => toggle(p.placeId)}
                  className="size-5 shrink-0 accent-ink"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-body">{p.name}</span>
                    <TierBadge tier={p.tier} />
                  </span>
                  <span className="truncate text-meta text-muted">
                    {[CUISINE_LABEL[p.cuisine], p.address.split(" ").slice(0, 2).join(" "), ...new Set(p.origins.map((o) => o.listName))]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {memo && <span className="truncate text-meta text-ink-2">{memo}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
