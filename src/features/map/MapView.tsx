"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL, type Cuisine } from "@/domain/cuisine";
import { TIER_LABEL, type Tier } from "@/domain/tier";
import { SOURCE_LABEL } from "@/features/import/sources";
import { SourceMark } from "@/components/brand/BrandLogo";
import { PlaceMap } from "./PlaceMap";
import type { MapPlace } from "./myPlaces";

const TIER_FILTERS: Tier[] = ["three", "two", "one", "notRecommended", "wantToGo", "unrated"];
const TIER_DOT: Record<Tier, string> = {
  three: "bg-tier-3",
  two: "bg-pin-2",
  one: "bg-pin-1",
  notRecommended: "bg-pin-none",
  wantToGo: "border border-ink-2 bg-white",
  unrated: "border border-pin-none bg-white",
};
const CUISINE_ORDER: Cuisine[] = ["korean", "chinese", "japanese", "western", "asian", "snack", "chicken", "bar", "cafe", "other", "nonFood"];

export function MapView({ places, initialTiers = [] }: { places: MapPlace[]; initialTiers?: Tier[] }) {
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [listOpen, setListOpen] = useState(!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY);

  const shown = useMemo(
    () =>
      places.filter(
        (p) => (tiers.length === 0 || tiers.includes(p.tier)) && (cuisines.length === 0 || cuisines.includes(p.cuisine)),
      ),
    [places, tiers, cuisines],
  );
  const pins = useMemo(() => shown.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, tier: p.tier })), [shown]);
  const presentCuisines = CUISINE_ORDER.filter((c) => places.some((p) => p.cuisine === c));
  const selected = shown.find((p) => p.placeId === selectedId) ?? null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="absolute inset-0">
        <PlaceMap pins={pins} selectedId={selected?.placeId ?? null} onSelect={setSelectedId} cluster />
      </div>

      <div className="pointer-events-none relative z-10 flex flex-col gap-1 pt-2">
        <ChipRow label="등급">
          <Chip pressed={tiers.length === 0} onClick={() => setTiers([])}>
            전체
          </Chip>
          {TIER_FILTERS.map((t) => (
            <Chip key={t} pressed={tiers.includes(t)} onClick={() => setTiers(toggle(tiers, t))}>
              <span aria-hidden="true" className={`size-2 rounded-full ${TIER_DOT[t]}`} />
              {TIER_LABEL[t]}
            </Chip>
          ))}
          <Chip pressed={cuisines.length > 0} onClick={() => setFilterOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {cuisines.length > 0 ? `음식 종류 ${cuisines.length}` : "음식 종류"}
          </Chip>
        </ChipRow>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={() => setFilterOpen(false)}>
          <section
            role="dialog"
            aria-label="음식 종류"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[480px] flex-col gap-4 rounded-t-[20px] bg-white px-5 pt-3 pb-6"
          >
            <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between">
              <h2 className="text-section font-bold">음식 종류</h2>
              {cuisines.length > 0 && (
                <button type="button" onClick={() => setCuisines([])} className="h-9 text-meta text-muted">
                  초기화
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presentCuisines.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cuisines.includes(c)}
                  onClick={() => setCuisines(toggle(cuisines, c))}
                  className={`h-9 rounded-full px-3.5 text-meta font-medium ${cuisines.includes(c) ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
                >
                  {CUISINE_LABEL[c]} <span className="opacity-60">{places.filter((p) => p.cuisine === c).length}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setFilterOpen(false)} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white">
              {shown.length}곳 보기
            </button>
          </section>
        </div>
      )}

      <div className="flex-1" />

      <section className="relative z-10 rounded-t-2xl bg-white px-5 pt-2 pb-5 shadow-sheet">
        <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-9 rounded-full bg-line-strong" />
        {selected ? (
          <PlaceCard place={selected} onClose={() => setSelectedId(null)} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-body font-bold">{shown.length}곳</span>
              <button type="button" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} className="h-btn-m text-meta text-ink-2">
                {listOpen ? "목록 닫기" : "목록 보기"}
              </button>
            </div>
            {listOpen && (
              <ul className="max-h-[40dvh] overflow-y-auto">
                {shown.map((p) => (
                  <li key={p.placeId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.placeId)}
                      className="flex min-h-14 w-full items-center gap-3 border-b border-line text-left"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body">{p.name}</span>
                        <span className="truncate text-meta text-muted">{placeMeta(p)}</span>
                      </span>
                      <TierBadge tier={p.tier} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function PlaceCard({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <Link href={`/p/${place.placeId}`} className="truncate text-section font-bold underline-offset-[3px] hover:underline">
              {place.name}
            </Link>
            <TierBadge tier={place.tier} />
          </span>
          <span className="text-meta text-muted">
            {placeMeta(place)}
            {!place.available && " · 지도에 정보 없음"}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {place.note && (
        <p className="rounded-btn-s bg-surface px-3 py-2.5 text-meta leading-normal text-ink-2">
          <span className="text-muted">내 메모</span> · {place.note}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 pt-2">
        {place.links[0] ? (
          <a
            href={place.links[0].url}
            target="_blank"
            rel="noreferrer"
            className="flex h-btn-m items-center justify-center gap-2 rounded-btn-m border border-line-strong text-body text-ink"
          >
            <SourceMark source={place.links[0].source} />
            {SOURCE_LABEL[place.links[0].source]}에서 보기
          </a>
        ) : (
          <span />
        )}
        <Link
          href={`/rate/${place.placeId}?next=/map`}
          className="flex h-btn-m items-center justify-center rounded-btn-m bg-brand text-body font-bold text-white"
        >
          {["three", "two", "one", "notRecommended"].includes(place.tier) ? "평가 수정" : "평가하기"}
        </Link>
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="pointer-events-auto flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
      {children}
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className="flex h-11 shrink-0 items-center">
      <span
        className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-meta whitespace-nowrap shadow-float ${
          pressed ? "bg-ink font-bold text-white" : "bg-white text-ink"
        }`}
      >
        {children}
      </span>
    </button>
  );
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function placeMeta(p: MapPlace): string {
  const region = p.address.split(" ").slice(0, 2).join(" ");
  return [...new Set([CUISINE_LABEL[p.cuisine], p.categoryName, region])].filter((v) => v && v !== "음식점").join(" · ");
}
