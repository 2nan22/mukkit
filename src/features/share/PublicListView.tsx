"use client";

import { useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { PublicList } from "./publicList";

export function PublicListView({ list }: { list: PublicList }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pins = useMemo(() => list.places.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, tier: p.tier ?? "unrated" })), [list.places]);

  return (
    <>
      <div className="relative h-[42dvh] shrink-0">
        <div className="absolute inset-0">
          <PlaceMap pins={pins} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <BackButton fallback="/" className="absolute top-3 left-3 z-10 rounded-full bg-white shadow-float" />
      </div>
      <ul className="flex flex-col px-5">
        {list.places.map((p) => (
          <li key={p.placeId}>
            <button
              type="button"
              onClick={() => setSelectedId(p.placeId)}
              aria-pressed={p.placeId === selectedId}
              className={`flex min-h-16 w-full items-center gap-3 border-b border-line py-2 text-left ${p.placeId === selectedId ? "bg-surface" : ""}`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body">{p.name}</span>
                <span className="truncate text-meta text-muted">
                  {[CUISINE_LABEL[p.cuisine], p.categoryName, regionOf(p.address)].filter((v, i, a) => v && a.indexOf(v) === i).join(" · ")}
                </span>
              </span>
              {p.tier && <TierBadge tier={p.tier} />}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
