"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { Tier } from "@/domain/tier";

// 카카오맵 JS SDK 에서 쓰는 만큼만 — 공식 타입 패키지가 없다
type LatLng = object;
type KakaoMaps = {
  load(cb: () => void): void;
  Map: new (el: HTMLElement, opts: { center: LatLng; level: number }) => KakaoMapInstance;
  LatLng: new (lat: number, lng: number) => LatLng;
  LatLngBounds: new () => { extend(p: LatLng): void };
  CustomOverlay: new (opts: {
    position: LatLng;
    content: HTMLElement;
    map: KakaoMapInstance;
    xAnchor: number;
    yAnchor: number;
    zIndex: number;
    clickable: boolean;
  }) => KakaoOverlay;
};
type KakaoMapInstance = { setBounds(b: object, top?: number, right?: number, bottom?: number, left?: number): void; relayout(): void };
type KakaoOverlay = { setMap(m: KakaoMapInstance | null): void };

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

export type Pin = { id: string; lat: number; lng: number; tier: Tier };

const APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
const SEOUL = { lat: 37.5665, lng: 126.978 };

const PIN_STYLE: Record<Tier, { size: number; bg: string; ring: string; text: string; label: string }> = {
  three: { size: 22, bg: "#b93a06", ring: "#ffffff", text: "#ffffff", label: "3" },
  two: { size: 22, bg: "#e8590c", ring: "#ffffff", text: "#ffffff", label: "2" },
  one: { size: 22, bg: "#f5a524", ring: "#ffffff", text: "#3d2800", label: "1" },
  notRecommended: { size: 14, bg: "#adb1b8", ring: "#ffffff", text: "#ffffff", label: "" },
  wantToGo: { size: 16, bg: "#ffffff", ring: "#5b5f69", text: "#5b5f69", label: "" },
  unrated: { size: 14, bg: "#ffffff", ring: "#adb1b8", text: "#5b5f69", label: "" },
};

function pinElement(tier: Tier, selected: boolean, onClick: () => void): HTMLElement {
  const s = PIN_STYLE[tier];
  const size = selected ? s.size + 8 : s.size;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", "장소 선택");
  el.style.cssText = "padding:0;border:0;background:none;cursor:pointer";
  el.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${s.bg};border:${selected ? 3 : 2}px solid ${s.ring};box-shadow:0 2px 8px rgba(0,0,0,.18);color:${s.text};font:700 11px/1 system-ui">${s.label}</span>`;
  el.addEventListener("click", onClick);
  return el;
}

export function PlaceMap({ pins, selectedId, onSelect }: { pins: Pin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<KakaoMapInstance | null>(null);
  const overlays = useRef<KakaoOverlay[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !el.current) return;
    if (!map.current) {
      map.current = new maps.Map(el.current, { center: new maps.LatLng(SEOUL.lat, SEOUL.lng), level: 8 });
    }
    const m = map.current;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = pins.map((p) => {
      const selected = p.id === selectedId;
      return new maps.CustomOverlay({
        position: new maps.LatLng(p.lat, p.lng),
        content: pinElement(p.tier, selected, () => onSelectRef.current(p.id)),
        map: m,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: selected ? 1000 : p.tier === "three" ? 300 : p.tier === "two" ? 200 : 100,
        clickable: true,
      });
    });
  }, [ready, pins, selectedId]);

  // 거르기가 바뀌면 보이는 핀이 다 들어오게
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current || pins.length === 0) return;
    const bounds = new maps.LatLngBounds();
    pins.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
    map.current.setBounds(bounds, 160, 40, 220, 40);
  }, [ready, pins]);

  if (!APP_KEY || failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-map-land px-8 text-center">
        <p className="text-body font-bold">지도를 불러오지 못했어요</p>
        <p className="text-meta leading-normal text-muted">
          {APP_KEY
            ? "카카오맵 인증에 실패했어요. 카카오 개발자 콘솔의 JavaScript SDK 도메인에 지금 주소가 있는지 확인해 주세요."
            : "카카오맵 키(NEXT_PUBLIC_KAKAO_MAP_KEY)가 아직 없어요. 아래 목록으로 볼 수 있어요."}
        </p>
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&autoload=false`}
        strategy="afterInteractive"
        onReady={() => {
          if (!window.kakao?.maps) return setFailed(true);
          window.kakao.maps.load(() => setReady(true));
        }}
        onError={() => setFailed(true)}
      />
      <div ref={el} className="h-full w-full bg-map-land" aria-label="내 장소 지도" role="application" />
    </>
  );
}
