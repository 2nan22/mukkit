"use client";

import { useEffect, useRef } from "react";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { TierIcon } from "@/components/ui/TierIcon";
import { TIER_LABEL, type Tier } from "@/domain/tier";
import { PlaceThumb } from "@/components/ui/PlaceThumb";
import { ratersLine, type MapPlace } from "./myPlaces";

const SHOWN = 10;

function distance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

// meters: 내 위치에서의 거리 (내 위치를 켜지 않았으면 없음 — 업종을 보여 준다)
export type NearPlace = MapPlace & { meters: number | null };

// 접힌 목록 — 지금 보이는 지도 안의 내 장소를 가운데에서 가까운 순으로 옆으로 넘겨 보기
// onFocus: 지금 맨 앞에 보이는 카드의 가게 — 지도에서 그 핀을 강조한다
export function PeekCards({
  places,
  covers,
  onPick,
  onMore,
  onFocus,
  listOf,
}: {
  places: NearPlace[];
  covers: Record<string, string>;
  onPick: (placeId: string) => void;
  onMore: () => void;
  onFocus?: (placeId: string | null) => void;
  // 리스트로 보기 — 핀 색을 정한 리스트 (외 N)
  listOf?: (placeId: string) => { name: string; hex: string; more: number } | null;
}) {
  const list = useRef<HTMLUListElement>(null);
  const first = places[0]?.placeId;
  const ids = places.slice(0, SHOWN).map((p) => p.placeId).join(",");
  // 지도를 옮겨 맨 앞 가게가 바뀌면 처음으로 — 살짝 움직였을 땐 그대로
  useEffect(() => {
    list.current?.scrollTo({ left: 0 });
    onFocus?.(first ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 맨 앞 가게가 바뀔 때만
  }, [first]);
  // 넘길 때마다 맨 앞 카드
  useEffect(() => {
    const el = list.current;
    if (!el || !onFocus) return;
    const order = ids ? ids.split(",") : [];
    let t = 0;
    const pick = () => {
      const card = el.querySelector("li");
      const step = card ? card.getBoundingClientRect().width + 8 : 1;
      onFocus(order[Math.min(order.length - 1, Math.round(el.scrollLeft / step))] ?? null);
    };
    // 순서만 바뀌고 스크롤은 그대로일 때도 맞춘다
    pick();
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(pick, 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
    };
  }, [ids, onFocus]);
  // 목록이 사라지면 강조도 지운다
  useEffect(() => () => onFocus?.(null), [onFocus]);

  return (
    <ul ref={list} className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
      {places.slice(0, SHOWN).map((p) => (
        <li key={p.placeId} className="shrink-0 snap-start">
          <button type="button" onClick={() => onPick(p.placeId)} className="flex h-16 w-56 items-center gap-2.5 rounded-[14px] border border-line bg-white px-2.5 text-left">
            <PlaceThumb src={covers[p.placeId]} cuisine={p.cuisine} kind={p.kind} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body font-semibold">{p.name}</span>
              {listOf ? (
                <ListLine l={listOf(p.placeId)} tier={p.tier} />
              ) : (
                <span className="flex items-center gap-1.5 truncate text-meta text-muted">
                  <TierIcon tier={p.tier} height={12} />
                  {p.raters ? ratersLine(p.raters) : TIER_LABEL[p.tier]} · {p.meters !== null ? distance(p.meters) : CUISINE_LABEL[p.cuisine]}
                </span>
              )}
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

// 리스트로 보기 카드 둘째 줄 — 색 점 + 리스트 이름(외 N) · 등급
function ListLine({ l, tier }: { l: { name: string; hex: string; more: number } | null; tier: Tier }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-meta text-muted">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${l ? "" : "border border-pin-none bg-white"}`} style={l ? { background: l.hex } : undefined} />
      <span className="truncate">{l ? `${l.name}${l.more > 0 ? ` 외 ${l.more}` : ""}` : "리스트 없음"}</span>
      <span className="shrink-0">· {TIER_LABEL[tier]}</span>
    </span>
  );
}
