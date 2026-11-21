"use client";

import { useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { PlaceRow } from "@/components/ui/PlaceRow";
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
      <ul className="flex flex-col px-5 pt-2">
        {list.places.map((p) => (
          <li key={p.placeId}>
            <PlaceRow
              onClick={() => setSelectedId(p.placeId)}
              selected={p.placeId === selectedId}
              name={p.name}
              cuisine={p.cuisine}
              tier={p.tier}
              meta={[CUISINE_LABEL[p.cuisine], p.categoryName, regionOf(p.address)].filter((v, i, a) => v && v !== "음식점" && a.indexOf(v) === i).join(" · ")}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
