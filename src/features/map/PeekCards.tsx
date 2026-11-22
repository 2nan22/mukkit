"use client";

import { useEffect, useRef } from "react";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { TIER_LABEL, type Tier } from "@/domain/tier";
import { PlaceThumb } from "@/components/ui/PlaceThumb";
import type { MapPlace } from "./myPlaces";

const TIER_DOT: Record<Tier, string> = {
  three: "bg-tier-3",
  two: "bg-pin-2",
  one: "bg-pin-1",
  notRecommended: "bg-pin-none",
  wantToGo: "border border-ink-2 bg-white",
  unrated: "border border-pin-none bg-white",
};
const SHOWN = 10;

function distance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

// meters: 내 위치에서의 거리 (내 위치를 켜지 않았으면 없음 — 업종을 보여 준다)
export type NearPlace = MapPlace & { meters: number | null };

// 접힌 목록 — 지금 보이는 지도 안의 내 장소를 가운데에서 가까운 순으로 옆으로 넘겨 보기
export function PeekCards({ places, covers, onPick, onMore }: { places: NearPlace[]; covers: Record<string, string>; onPick: (placeId: string) => void; onMore: () => void }) {
  const list = useRef<HTMLUListElement>(null);
  const first = places[0]?.placeId;
  // 지도를 옮겨 맨 앞 가게가 바뀌면 처음으로 — 살짝 움직였을 땐 그대로
  useEffect(() => {
    list.current?.scrollTo({ left: 0 });
  }, [first]);

  return (
    <ul ref={list} className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
      {places.slice(0, SHOWN).map((p) => (
        <li key={p.placeId} className="shrink-0 snap-start">
          <button type="button" onClick={() => onPick(p.placeId)} className="flex h-16 w-56 items-center gap-2.5 rounded-[14px] border border-line bg-white px-2.5 text-left">
            <PlaceThumb src={covers[p.placeId]} cuisine={p.cuisine} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body font-semibold">{p.name}</span>
              <span className="flex items-center gap-1.5 truncate text-meta text-muted">
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${TIER_DOT[p.tier]}`} />
                {TIER_LABEL[p.tier]} · {p.meters !== null ? distance(p.meters) : CUISINE_LABEL[p.cuisine]}
              </span>
            </span>
          </button>
        </li>
      ))}
      {places.length > SHOWN && (
        <li className="shrink-0 snap-start">
          <button type="button" onClick={onMore} className="flex h-16 w-32 items-center justify-center rounded-[14px] bg-surface text-meta font-semibold text-ink">
            {places.length}곳 모두 보기
          </button>
        </li>
      )}
    </ul>
  );
}
