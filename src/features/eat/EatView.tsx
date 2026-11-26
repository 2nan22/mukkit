"use client";

import { EatingLoader } from "@/components/ui/EatingLoader";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { Tier } from "@/domain/tier";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import type { CuisineGroup } from "@/domain/eatScore";
import { findEats, findSpots, type Spot } from "./actions";
import type { Region } from "./eat";
import { MetaLine } from "@/components/ui/MetaLine";

const RADII = [500, 1000, 3000] as const;
type Where = { label: string; lat: number; lng: number };

// 내 등급은 배지로 이미 보이니 이유에서는 남의 평가 · 취향만
function othersReasons(reasons: string[]): string[] {
  return reasons.filter((r) => !r.startsWith("내 ") && !r.startsWith("내가 "));
}

function km(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

// initial: 장소 상세에서 '이 근처에서 뭐 먹지'로 왔을 때 — 서버가 그 가게 기준 1km 추천을 미리 계산해 둔다
export function EatView({ regions, initial = null }: { regions: Region[]; initial?: { where: Where; groups: CuisineGroup[] } | null }) {
  const [where, setWhere] = useState<Where | null>(initial?.where ?? null);
  const [radius, setRadius] = useState<(typeof RADII)[number]>(1000);
  const [groups, setGroups] = useState<CuisineGroup[] | null>(initial?.groups ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  // 기준 위치 찾기 — 역 · 동네 · 가게 이름 (누를 때만 찾는다: 외부 검색 횟수를 아끼게)
  const [spotQuery, setSpotQuery] = useState("");
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [findingSpots, startSpots] = useTransition();
  function lookupSpots() {
    const q = spotQuery.trim();
    if (!q) return;
    startSpots(async () => {
      const res = await findSpots(q);
      setSpots(res.spots ?? []);
      if (res.error) setError(res.error);
    });
  }
  function pickSpot(s: Spot) {
    setSpots(null);
    setSpotQuery(s.name);
    search({ label: s.name, lat: s.lat, lng: s.lng });
  }
  const pins = useMemo(
    () =>
      (groups ?? []).flatMap((g) =>
        g.places.map((p) => ({
          id: p.placeId,
          lat: p.lat,
          lng: p.lng,
          tier: (p.myTier ?? (p.raters.some((r) => r.tier === "three") ? "three" : "two")) as Tier,
        })),
      ),
    [groups],
  );

  function pick(id: string) {
    setSelected(id);
    document.getElementById(`eat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function search(w: Where, r = radius) {
    setWhere(w);
    start(async () => {
      const res = await findEats(w.lat, w.lng, r);
      setError(res.error ?? null);
      setGroups(res.groups ?? null);
    });
  }

  function useHere() {
    if (!navigator.geolocation) return setError("이 브라우저에서는 위치를 쓸 수 없어요. 지역을 골라 주세요.");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => search({ label: "지금 위치", lat: coords.latitude, lng: coords.longitude }),
      () => setError("위치를 쓸 수 없어요. 브라우저 설정에서 허용하거나 지역을 골라 주세요."),
      { maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  }

  const total = groups?.reduce((n, g) => n + g.places.length, 0) ?? 0;

  return (
    <div className="flex flex-col gap-5 px-5 pb-10">
      {/* 저장한 곳이 없으면 추천 재료가 없다 — 빈 결과보다 먼저 무엇을 하면 되는지 */}
      {regions.length === 0 && (
        <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
          <p className="text-body font-semibold">아직 내 기록이 없어 추천이 적어요</p>
          <p className="text-meta text-ink-2">저장한 맛집을 가져오거나 취향 비슷한 사람을 팔로우하면 여기서 골라 드려요.</p>
          <div className="flex gap-3 pt-1 text-meta font-semibold text-ink">
            <Link href="/import" className="h-11 content-center underline underline-offset-[3px]">맛집 가져오기</Link>
            <Link href="/people" className="h-11 content-center underline underline-offset-[3px]">사람 찾기</Link>
          </div>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <button type="button" onClick={useHere} disabled={pending} className="flex h-btn-l items-center justify-center gap-2 rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          지금 위치에서 찾기
        </button>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            lookupSpots();
          }}
          className="flex gap-1.5"
        >
          <input
            type="search"
            value={spotQuery}
            onChange={(e) => {
              setSpotQuery(e.target.value);
              setSpots(null);
            }}
            maxLength={40}
            enterKeyHint="search"
            placeholder="역, 동네, 가게 이름으로 기준 정하기"
            aria-label="기준 위치 찾기"
            className="h-11 min-w-0 flex-1 rounded-[12px] bg-surface px-3.5 text-body outline-none focus:bg-white focus:ring-1 focus:ring-ink [&::-webkit-search-cancel-button]:hidden"
          />
          <button type="submit" disabled={!spotQuery.trim() || findingSpots} className="h-11 shrink-0 rounded-[12px] bg-surface px-4 text-meta font-semibold text-ink disabled:opacity-40">
            {findingSpots ? "찾는 중" : "찾기"}
          </button>
        </form>
        {spots && (
          <ul aria-label="기준 위치 후보" className="flex flex-col overflow-hidden rounded-[12px] border border-line">
            {spots.length === 0 && <li className="px-4 py-3 text-meta text-muted">찾는 곳이 없어요. 다른 이름으로 찾아 주세요.</li>}
            {spots.map((s) => (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => pickSpot(s)} className="flex min-h-12 w-full flex-col items-start justify-center px-4 py-2 text-left">
                  <span className="text-body font-semibold text-ink">{s.name}</span>
                  {s.meta.length > 0 && <MetaLine items={s.meta} />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {regions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-meta text-muted">자주 저장한 지역</span>
            <div className="relative -mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
              {regions.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  aria-pressed={where?.label === r.name}
                  onClick={() => search({ label: r.name, lat: r.lat, lng: r.lng })}
                  className={`h-8 shrink-0 rounded-full px-3 text-meta font-medium whitespace-nowrap ${where?.label === r.name ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div role="radiogroup" aria-label="반경" className="grid grid-cols-3 gap-1 rounded-btn-l bg-surface-2 p-1">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={radius === r}
              onClick={() => {
                setRadius(r);
                if (where) search(where, r);
              }}
              className={`h-9 rounded-btn-s text-meta ${radius === r ? "bg-ink font-bold text-white" : "text-muted"}`}
            >
              {km(r)} 안
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      {pending && (
        <div className="flex justify-center py-6">
          <EatingLoader size={40} label="추천을 찾는 중" />
        </div>
      )}

      {groups && where && pins.length > 0 && (
        <div className="relative -mx-5 h-[38dvh] min-h-60 overflow-hidden border-y border-line">
          <div className="absolute inset-0">
            <PlaceMap pins={pins} selectedId={selected} onSelect={pick} padding={[36, 36, 36, 36]} />
          </div>
        </div>
      )}

      {!pending && groups && where && (
        <section className="flex flex-col gap-8">
          <MetaLine className="text-meta text-subtle" items={[`${where.label} ${km(radius)} 안`, `${total}곳`]} />
          {groups.length === 0 && (
            <p className="rounded-btn-l bg-surface p-4 text-meta leading-normal text-ink-2">
              이 범위에는 저장하거나 평가한 곳이 없어요. 범위를 넓혀 보세요.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.cuisine} className="flex flex-col">
              <h2 className="sticky top-0 z-10 bg-white py-2 text-section font-bold">
                {CUISINE_LABEL[g.cuisine]} <span className="text-meta font-normal text-subtle">{g.places.length}곳</span>
              </h2>
              {g.places.map((p) => (
                <PlaceRow
                  key={p.placeId}
                  id={`eat-${p.placeId}`}
                  href={`/p/${p.placeId}`}
                  selected={selected === p.placeId}
                  name={p.name}
                  cuisine={p.cuisine}
                  tier={p.myTier}
                  meta={[km(p.distance), p.categoryName && !["음식점", CUISINE_LABEL[p.cuisine]].includes(p.categoryName) ? p.categoryName : null]}
                  note={othersReasons(p.reasons).length > 0 ? <MetaLine wrap className="text-meta text-ink-2" items={othersReasons(p.reasons)} /> : undefined}
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
