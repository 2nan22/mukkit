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
    map?: KakaoMapInstance;
    xAnchor: number;
    yAnchor: number;
    zIndex: number;
    clickable: boolean;
  }) => KakaoOverlay;
  MarkerClusterer?: new (opts: {
    map: KakaoMapInstance;
    averageCenter: boolean;
    minLevel: number;
    gridSize: number;
    minClusterSize: number;
    styles: Record<string, string>[];
  }) => KakaoClusterer;
};
type KakaoClusterer = { addMarkers(m: KakaoOverlay[]): void; clear(): void };
type KakaoMapInstance = {
  setBounds(b: object, top?: number, right?: number, bottom?: number, left?: number): void;
  getLevel(): number;
  setLevel(level: number): void;
  panTo(p: LatLng): void;
  setCenter(p: LatLng): void;
  relayout(): void;
};
type KakaoOverlay = { setMap(m: KakaoMapInstance | null): void };

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

export type Pin = { id: string; lat: number; lng: number; tier: Tier };

const APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
const SEOUL = { lat: 37.5665, lng: 126.978 };
const NEIGHBORHOOD_LEVEL = 5;
const SINGLE_LEVEL = 3;
// 이 레벨부터 멀리 볼 때만 묶는다 — 동네 단위에선 핀을 그대로
const CLUSTER_LEVEL = 7;
const CLUSTER_STYLE = {
  width: "36px",
  height: "36px",
  lineHeight: "36px",
  borderRadius: "50%",
  background: "#17181c",
  border: "2px solid #ffffff",
  boxShadow: "0 2px 8px rgba(0,0,0,.2)",
  color: "#ffffff",
  textAlign: "center",
  font: "700 13px/36px system-ui",
};

const PIN_STYLE: Record<Tier, { size: number; bg: string; ring: string; text: string; label: string }> = {
  three: { size: 22, bg: "#b42330", ring: "#ffffff", text: "#ffffff", label: "3" },
  two: { size: 22, bg: "#e8590c", ring: "#ffffff", text: "#ffffff", label: "2" },
  one: { size: 22, bg: "#f5a524", ring: "#ffffff", text: "#3d2800", label: "1" },
  notRecommended: { size: 10, bg: "#adb1b8", ring: "#ffffff", text: "#ffffff", label: "" },
  wantToGo: { size: 12, bg: "#ffffff", ring: "#5b5f69", text: "#5b5f69", label: "" },
  unrated: { size: 10, bg: "#ffffff", ring: "#adb1b8", text: "#5b5f69", label: "" },
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

// padding: 핀을 다 넣을 때 위 · 오른쪽 · 아래 · 왼쪽 여백 — 지도 위에 겹치는 칩 · 시트만큼
const SHEET_PADDING = [160, 40, 220, 40] as const;

export function PlaceMap({
  pins,
  selectedId,
  onSelect,
  padding = SHEET_PADDING,
  cluster = false,
}: {
  pins: Pin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  padding?: readonly [number, number, number, number];
  // 핀이 많은 지도에서 멀리 볼 때 개수 원으로 묶기
  cluster?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<KakaoMapInstance | null>(null);
  const overlays = useRef<KakaoOverlay[]>([]);
  const clusterer = useRef<KakaoClusterer | null>(null);
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
      // 컨테이너 크기가 그려진 뒤에 지도 크기를 다시 맞춘다 — 안 하면 타일이 반만 깔린다
      const m0 = map.current;
      requestAnimationFrame(() => m0.relayout());
    }
    const m = map.current;
    clusterer.current?.clear();
    overlays.current.forEach((o) => o.setMap(null));
    const useCluster = cluster && Boolean(maps.MarkerClusterer);
    if (useCluster && !clusterer.current && maps.MarkerClusterer) {
      clusterer.current = new maps.MarkerClusterer({
        map: m,
        averageCenter: true,
        minLevel: CLUSTER_LEVEL,
        gridSize: 64,
        minClusterSize: 3,
        styles: [CLUSTER_STYLE],
      });
    }
    overlays.current = pins.map((p) => {
      const selected = p.id === selectedId;
      return new maps.CustomOverlay({
        position: new maps.LatLng(p.lat, p.lng),
        content: pinElement(p.tier, selected, () => onSelectRef.current(p.id)),
        map: useCluster ? undefined : m,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: selected ? 1000 : p.tier === "three" ? 300 : p.tier === "two" ? 200 : 100,
        clickable: true,
      });
    });
    if (useCluster) clusterer.current?.addMarkers(overlays.current);
  }, [ready, pins, selectedId, cluster]);

  // 고른 장소로 다가간다 — 동네가 보일 만큼만 확대
  useEffect(() => {
    const maps = window.kakao?.maps;
    const pin = pins.find((p) => p.id === selectedId);
    if (!ready || !maps || !map.current || !pin) return;
    if (map.current.getLevel() > NEIGHBORHOOD_LEVEL) map.current.setLevel(NEIGHBORHOOD_LEVEL);
    map.current.panTo(new maps.LatLng(pin.lat, pin.lng));
  }, [ready, pins, selectedId]);

  // 거르기가 바뀌면 보이는 핀이 다 들어오게
  const [top, right, bottom, left] = padding;
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current || pins.length === 0) return;
    const m = map.current;
    requestAnimationFrame(() => {
      m.relayout();
      if (pins.length === 1) {
        m.setLevel(SINGLE_LEVEL);
        m.setCenter(new maps.LatLng(pins[0].lat, pins[0].lng));
        return;
      }
      const bounds = new maps.LatLngBounds();
      pins.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
      m.setBounds(bounds, top, right, bottom, left);
    });
  }, [ready, pins, top, right, bottom, left]);

  if (!APP_KEY || failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-map-land px-8 text-center">
        <p className="text-body font-bold">지도를 불러오지 못했어요</p>
        <p className="text-meta leading-normal text-muted">잠시 후 다시 열어 주세요.</p>
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&autoload=false&libraries=clusterer`}
        strategy="afterInteractive"
        onReady={() => {
          if (!window.kakao?.maps) return setFailed(true);
          window.kakao.maps.load(() => setReady(true));
        }}
        onError={() => setFailed(true)}
      />
      <div ref={el} className="h-full w-full bg-map-land" aria-label="내 장소 지도" role="application" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-map-land">
          <span className="sr-only">지도를 불러오는 중이에요</span>
        </div>
      )}
    </>
  );
}
