"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { Tier } from "@/domain/tier";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import type { CuisineGroup } from "@/domain/eatScore";
import { findEats } from "./actions";
import type { Region } from "./eat";

const RADII = [500, 1000, 3000] as const;
type Where = { label: string; lat: number; lng: number };

function km(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

export function EatView({ regions }: { regions: Region[] }) {
  const [where, setWhere] = useState<Where | null>(null);
  const [radius, setRadius] = useState<(typeof RADII)[number]>(1000);
  const [groups, setGroups] = useState<CuisineGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
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
      <section className="flex flex-col gap-3">
        <button type="button" onClick={useHere} disabled={pending} className="flex h-btn-l items-center justify-center gap-2 rounded-btn-l bg-ink text-[16px] font-bold text-white disabled:opacity-60">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          지금 위치에서 찾기
        </button>
        {regions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-meta text-muted">또는 저장한 지역에서</span>
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
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
              className={`h-9 rounded-btn-s text-meta ${radius === r ? "bg-white font-bold text-ink shadow-float" : "text-muted"}`}
            >
              {km(r)} 안
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-meta text-[#c4320a]">
          {error}
        </p>
      )}
      {pending && <p className="text-meta text-muted">찾는 중이에요</p>}

      {groups && where && pins.length > 0 && (
        <div className="relative -mx-5 h-[38dvh] min-h-60 overflow-hidden border-y border-line">
          <div className="absolute inset-0">
            <PlaceMap pins={pins} selectedId={selected} onSelect={pick} />
          </div>
        </div>
      )}

      {!pending && groups && where && (
        <section className="flex flex-col gap-8">
          <p className="text-meta text-subtle">
            {where.label} {km(radius)} 안 · {total}곳
          </p>
          {groups.length === 0 && (
            <p className="rounded-btn-l bg-surface p-4 text-meta leading-normal text-ink-2">
              이 근처엔 아직 없어요. 반경을 넓혀 보세요.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.cuisine} className="flex flex-col">
              <h2 className="sticky top-0 z-10 bg-white py-2 text-section font-bold">
                {CUISINE_LABEL[g.cuisine]} <span className="text-meta font-normal text-subtle">{g.places.length}곳</span>
              </h2>
              {g.places.map((p) => (
                <Link
                  key={p.placeId}
                  id={`eat-${p.placeId}`}
                  href={`/p/${p.placeId}`}
                  className={`-mx-2 flex flex-col gap-1 rounded-btn-m border-b border-line px-2 py-3.5 ${selected === p.placeId ? "bg-surface" : ""}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-body font-semibold">{p.name}</span>
                    {p.myTier && <TierBadge tier={p.myTier} />}
                    <span className="ml-auto shrink-0 text-meta text-subtle">{km(p.distance)}</span>
                  </span>
                  {p.categoryName && !["음식점", CUISINE_LABEL[p.cuisine]].includes(p.categoryName) && <span className="text-meta text-muted">{p.categoryName}</span>}
                  <span className="text-meta text-ink-2">{p.reasons.join(" · ")}</span>
                </Link>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
