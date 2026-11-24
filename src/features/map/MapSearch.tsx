"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { TierBadge } from "@/components/ui/TierBadge";
import { CuisineIcon } from "@/components/ui/CuisineIcon";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { searchAll, type NewPlaceHit } from "@/features/search/actions";
import type { MapPlace } from "./myPlaces";
import { MetaLine } from "@/components/ui/MetaLine";

const MINE_MAX = 8;
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

// 지도 위 검색 — 페이지를 넘기지 않고 지도 위에 결과를 띄운다
// 내 장소는 바로 거르고, 저장하지 않은 가게는 카카오 검색으로
export function MapSearch({
  places,
  onPickMine,
  onPickNew,
  onOpenChange,
  onClear,
  mineLabel = "내 장소",
  freshLabel = "저장하지 않은 가게",
  near = null,
}: {
  // 지금 보는 지도의 가운데 — 카카오 검색을 이 근처부터
  near?: { lat: number; lng: number } | null;
  places: MapPlace[];
  mineLabel?: string;
  freshLabel?: string;
  onPickMine: (placeId: string) => void;
  onPickNew: (hit: NewPlaceHit) => void;
  onOpenChange?: (open: boolean) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  // 검색을 시작하는 순간의 지도 가운데 (입력 중 지도가 움직여도 다시 묻지 않게 ref)
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);
  const [open, setOpen] = useState(false);
  // 검색어별 결과 — 지금 검색어의 결과만 보여 준다
  const [result, setResult] = useState<{ q: string; places: NewPlaceHit[] } | null>(null);
  const [searching, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const panel = open && q.length > 0;

  useEffect(() => {
    onOpenChange?.(panel);
  }, [panel, onOpenChange]);
  useEffect(() => {
    if (!q) return;
    const t = setTimeout(() => start(async () => setResult({ q, places: (await searchAll(q, nearRef.current, false)).places })), 300);
    return () => clearTimeout(t);
  }, [q]);

  const hits = result && result.q === q ? result.places : null;
  const mine = q ? places.filter((p) => norm(p.name).includes(norm(q))).slice(0, MINE_MAX) : [];
  const mineIds = new Set(places.map((p) => p.placeId));
  // 이미 저장한 가게가 카카오 결과에 한 번 더 나오면 뺀다 — id 가 같거나, 이름이 같고 약 300m 안
  const fresh = (hits ?? []).filter(
    (h) => !(h.placeId && mineIds.has(h.placeId)) && !places.some((p) => norm(p.name) === norm(h.name) && Math.abs(p.lat - h.lat) < 0.003 && Math.abs(p.lng - h.lng) < 0.0035),
  );

  function close() {
    setOpen(false);
    input.current?.blur();
  }

  return (
    <div className="pointer-events-auto relative flex flex-col gap-1.5 px-4">
      {/* 패널 바깥을 누르면 닫힘 */}
      {panel && <button type="button" aria-hidden="true" tabIndex={-1} onClick={close} className="fixed inset-0 z-0 cursor-default" />}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          input.current?.blur();
        }}
        className="relative z-10 flex h-12 items-center gap-2 rounded-[12px] bg-white pr-1 pl-3.5 shadow-float"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && close()}
          placeholder="가게 이름 검색"
          aria-label="지도에서 가게 검색"
          role="combobox"
          aria-expanded={panel}
          aria-controls="map-search-results"
          aria-autocomplete="list"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-body outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {panel ? (
          <button type="button" onClick={close} className="h-11 shrink-0 px-3 text-meta font-semibold text-ink-2">
            취소
          </button>
        ) : (
          query && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => {
                setQuery("");
                onClear?.();
              }}
              className="flex size-11 shrink-0 items-center justify-center text-muted"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )
        )}
      </form>

      {panel && (
        <div
          id="map-search-results"
          onPointerDown={() => input.current?.blur()}
          className="relative z-10 max-h-[min(55dvh,420px)] overflow-y-auto overscroll-contain rounded-[16px] bg-white px-4 py-2 shadow-float"
        >
          <p role="status" className="sr-only">
            {hits ? `${mineLabel} ${mine.length}곳, ${freshLabel} ${fresh.length}곳` : ""}
          </p>
          {mine.length > 0 && (
            <ul aria-label={mineLabel}>
              <li aria-hidden="true" className="pt-1 pb-0.5 text-caption font-semibold text-muted">
                {mineLabel}
              </li>
              {mine.map((p) => (
                <li key={p.placeId}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickMine(p.placeId);
                      close();
                    }}
                    className="flex min-h-14 w-full items-center gap-3 border-b border-line text-left"
                  >
                    <CuisineIcon cuisine={p.cuisine} size={40} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body font-semibold">{p.name}</span>
                      <MetaLine items={[CUISINE_LABEL[p.cuisine], p.address.split(" ").slice(0, 2).join(" ")]} />
                    </span>
                    <TierBadge tier={p.tier} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fresh.length > 0 && (
            <ul aria-label={freshLabel}>
              <li aria-hidden="true" className="pt-3 pb-0.5 text-caption font-semibold text-muted">
                {freshLabel}
              </li>
              {fresh.slice(0, 8).map((h) => (
                <li key={h.kakaoId}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickNew(h);
                      close();
                    }}
                    className="flex min-h-14 w-full items-center gap-3 border-b border-line text-left"
                  >
                    <CuisineIcon cuisine={h.cuisine} size={40} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body font-semibold">{h.name}</span>
                      <MetaLine items={h.meta} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searching && !hits && <p className="py-3 text-meta text-muted">검색 중</p>}
          {hits && mine.length === 0 && fresh.length === 0 && <p className="py-4 text-center text-meta text-muted">검색 결과가 없어요</p>}
          <Link href={`/search?q=${encodeURIComponent(q)}`} className="flex min-h-12 items-center justify-between text-meta font-semibold text-ink-2">
            ‘{q}’ 사람 검색
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      )}
    </div>
  );
}
