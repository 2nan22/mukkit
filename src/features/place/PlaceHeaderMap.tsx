"use client";

import { useState } from "react";
import { useLeave } from "@/lib/nav/useLeave";
import type { Tier } from "@/domain/tier";
import { honor } from "@/domain/honor";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { PlaceCover } from "./covers";

// 장소 상세 위쪽 — 대표 사진(사용자가 올린 평가 사진)이 있으면 사진, '지도 보기'로 바꿔 보기. 없으면 지도
export function PlaceHeaderMap({ id, name, lat, lng, tier, cover = null }: { id: string; name: string; lat: number; lng: number; tier: Tier; cover?: PlaceCover | null }) {
  const leave = useLeave("/home");
  const [showMap, setShowMap] = useState(!cover);
  return (
    <div className="relative h-[200px] shrink-0 overflow-hidden bg-map-land">
      {cover && !showMap ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다 */}
          <img src={cover.url} alt={`${name} — ${cover.mine ? "내가" : `${honor(cover.ownerNickname)}이`} 올린 사진`} className="absolute inset-0 size-full object-cover" />
          {/* 밝은 사진에서도 버튼 · 글자가 보이게 위아래만 살짝 어둡게 */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40" />
        </>
      ) : (
        <div className="absolute inset-0">
          <PlaceMap pins={[{ id, lat, lng, tier }]} selectedId={id} onSelect={() => undefined} quiet />
        </div>
      )}
      <button
        type="button"
        onClick={leave}
        aria-label="뒤로"
        className="absolute top-3 left-3 z-10 flex size-11 items-center justify-center rounded-full bg-white shadow-float"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      {cover && (
        <div className="absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-2">
          {!showMap ? (
            <span className="max-w-[60%] min-w-0 truncate rounded-full bg-black/65 px-2.5 py-1 text-caption text-white backdrop-blur-sm">{cover.mine ? "내 사진" : `${honor(cover.ownerNickname)} 사진`}</span>
          ) : (
            <span />
          )}
          <button type="button" onClick={() => setShowMap(!showMap)} className="flex h-11 shrink-0 items-center">
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-meta font-semibold text-ink shadow-float">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                {showMap ? (
                  <>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 16l5-5 4 4 3-3 6 6" />
                  </>
                ) : (
                  <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />
                )}
              </svg>
              {showMap ? "사진 보기" : "지도 보기"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
