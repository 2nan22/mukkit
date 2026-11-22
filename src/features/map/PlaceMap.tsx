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
  LatLngBounds: new () => KakaoBounds;
  CustomOverlay: new (opts: {
    position: LatLng;
    content: HTMLElement;
    map?: KakaoMapInstance;
    xAnchor: number;
    yAnchor: number;
    zIndex: number;
    clickable: boolean;
  }) => KakaoOverlay;
  Circle: new (opts: {
    center: LatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
    map?: KakaoMapInstance;
  }) => KakaoCircle;
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
type KakaoBounds = { extend(p: LatLng): void; contain(p: LatLng): boolean };
type KakaoCircle = { setMap(m: KakaoMapInstance | null): void; setPosition(p: LatLng): void; setRadius(r: number): void; setOptions(o: { strokeOpacity: number; fillOpacity: number }): void };
type KakaoMapInstance = {
  setBounds(b: object, top?: number, right?: number, bottom?: number, left?: number): void;
  getLevel(): number;
  setLevel(level: number, opts?: { animate?: boolean }): void;
  panTo(p: LatLng | KakaoBounds, padding?: number): void;
  getBounds(): KakaoBounds;
  setCenter(p: LatLng): void;
  relayout(): void;
};
type KakaoOverlay = {
  setMap(m: KakaoMapInstance | null): void;
  setContent(el: HTMLElement): void;
  setZIndex(z: number): void;
  setPosition(p: LatLng): void;
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps & { event: { addListener(target: object, type: string, cb: () => void): void } } };
  }
}

export type Pin = { id: string; lat: number; lng: number; tier: Tier; kind?: "found" };
export type MyLocation = { lat: number; lng: number; accuracy: number };

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
  background: "#ffffff",
  border: "1px solid #dddfe3",
  boxShadow: "0 2px 8px rgba(0,0,0,.2)",
  color: "#17181c",
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

// 지도 검색으로 찾은 가게 — 내 등급 핀과 헷갈리지 않는 검정 핀
function foundElement(): HTMLElement {
  const el = document.createElement("span");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "검색한 가게");
  el.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:28px;height:28px;box-sizing:border-box;border-radius:50%;background:#17181c;border:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,.3)";
  el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#ffffff"></span>';
  return el;
}

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

// 내 위치 색 — 장소 핀(빨강 · 주황 · 노랑 · 회색)과 겹치지 않는 지도 앱 관례의 파랑 (globals.css --color-me 와 같은 값)
const ME_COLOR = "#2f6fde";

function zOf(tier: Tier, selected: boolean): number {
  return selected ? 1000 : tier === "three" ? 300 : tier === "two" ? 200 : 100;
}

// 내 위치 점 — 장소 핀과 헷갈리지 않게 파란 점 · 흰 테두리
function meElement(): HTMLElement {
  const el = document.createElement("span");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    `display:block;width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:${ME_COLOR};border:3px solid #ffffff;box-shadow:0 0 0 1px rgba(47,111,222,.35),0 2px 6px rgba(0,0,0,.25);pointer-events:none`;
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
  focus = null,
  refit = "always",
  me = null,
  onUserMove,
  zoomRef,
}: {
  pins: Pin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  padding?: readonly [number, number, number, number];
  // 핀이 많은 지도에서 멀리 볼 때 개수 원으로 묶기
  cluster?: boolean;
  // 이 자리 · 확대 수준으로 연다 (처음 열 때 · 현재 위치 버튼) — 없으면 핀 전체에 맞춘다
  focus?: { lat: number; lng: number; level: number } | null;
  // 핀이 바뀔 때 — always: 매번 전체에 맞춤 / hidden: 처음만 맞추고, 이후엔 보이는 핀이 하나도 없을 때만 부드럽게 옮김
  refit?: "always" | "hidden";
  // 내 위치 점 · 정확도 원
  me?: MyLocation | null;
  // 사용자가 손으로 지도를 옮겼을 때
  onUserMove?: () => void;
  // 확대 · 축소 — 바깥 버튼이 부른다 (지도 탭)
  zoomRef?: { current: ((step: number) => void) | null };
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<KakaoMapInstance | null>(null);
  const overlays = useRef<Map<string, { overlay: KakaoOverlay; pin: Pin }>>(new Map());
  const selectedRef = useRef<string | null>(selectedId);
  const fitted = useRef(false);
  const meDot = useRef<KakaoOverlay | null>(null);
  const meCircle = useRef<KakaoCircle | null>(null);
  const clusterer = useRef<KakaoClusterer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onUserMove);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onMoveRef.current = onUserMove;
  }, [onSelect, onUserMove]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !el.current) return;
    if (!map.current) {
      map.current = new maps.Map(el.current, { center: new maps.LatLng(SEOUL.lat, SEOUL.lng), level: 8 });
      // 컨테이너 크기가 그려진 뒤에 지도 크기를 다시 맞춘다 — 안 하면 타일이 반만 깔린다
      const m0 = map.current;
      requestAnimationFrame(() => m0.relayout());
      window.kakao?.maps.event.addListener(m0, "dragstart", () => onMoveRef.current?.());
    }
    const m = map.current;
    clusterer.current?.clear();
    overlays.current.forEach(({ overlay }) => overlay.setMap(null));
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
    // 핀이 바뀔 때만 다시 만든다 — 고르기는 아래에서 두 핀만 바꾼다
    const next = new Map<string, { overlay: KakaoOverlay; pin: Pin }>();
    for (const p of pins) {
      const selected = p.id === selectedRef.current;
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(p.lat, p.lng),
        content: p.kind === "found" ? foundElement() : pinElement(p.tier, selected, () => onSelectRef.current(p.id)),
        map: useCluster && p.kind !== "found" ? undefined : m,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: p.kind === "found" ? 1000 : zOf(p.tier, selected),
        clickable: p.kind !== "found",
      });
      next.set(p.id, { overlay, pin: p });
    }
    overlays.current = next;
    if (useCluster) clusterer.current?.addMarkers([...next.values()].filter((v) => v.pin.kind !== "found").map((v) => v.overlay));
  }, [ready, pins, cluster]);

  // 고른 핀 표시 — 이전 · 새 핀 두 개만 바꾼다
  useEffect(() => {
    const prev = selectedRef.current;
    selectedRef.current = selectedId;
    if (!ready || prev === selectedId) return;
    for (const id of [prev, selectedId]) {
      const hit = id ? overlays.current.get(id) : undefined;
      if (!hit || hit.pin.kind === "found") continue;
      const on = id === selectedId;
      hit.overlay.setContent(pinElement(hit.pin.tier, on, () => onSelectRef.current(hit.pin.id)));
      hit.overlay.setZIndex(zOf(hit.pin.tier, on));
    }
  }, [ready, selectedId]);

  // 고른 장소로 다가간다 — 동네가 보일 만큼만 확대
  useEffect(() => {
    const maps = window.kakao?.maps;
    const pin = pins.find((p) => p.id === selectedId);
    if (!ready || !maps || !map.current || !pin) return;
    if (map.current.getLevel() > NEIGHBORHOOD_LEVEL) map.current.setLevel(NEIGHBORHOOD_LEVEL);
    map.current.panTo(new maps.LatLng(pin.lat, pin.lng));
  }, [ready, pins, selectedId]);

  // 거르기가 바뀌면 보이는 핀이 다 들어오게 — hidden 이면 처음 한 번만, 이후엔 화면에 하나도 없을 때만 부드럽게
  const [top, right, bottom, left] = padding;
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current || pins.length === 0) return;
    const m = map.current;
    requestAnimationFrame(() => {
      m.relayout();
      if (refit === "hidden" && fitted.current) {
        const view = m.getBounds();
        if (pins.some((p) => view.contain(new maps.LatLng(p.lat, p.lng)))) return;
        const target = new maps.LatLngBounds();
        pins.forEach((p) => target.extend(new maps.LatLng(p.lat, p.lng)));
        m.panTo(target, Math.max(top, bottom));
        return;
      }
      fitted.current = true;
      if (pins.length === 1) {
        m.setLevel(SINGLE_LEVEL);
        m.setCenter(new maps.LatLng(pins[0].lat, pins[0].lng));
        return;
      }
      const bounds = new maps.LatLngBounds();
      pins.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
      m.setBounds(bounds, top, right, bottom, left);
    });
  }, [ready, pins, top, right, bottom, left, refit]);

  // 핀 맞춤보다 뒤에 돌도록 아래에 둔다 — 같은 프레임이면 이 위치가 이긴다
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current || !focus) return;
    const m = map.current;
    requestAnimationFrame(() => {
      fitted.current = true;
      m.setLevel(focus.level);
      m.setCenter(new maps.LatLng(focus.lat, focus.lng));
    });
  }, [ready, focus]);

  useEffect(() => {
    if (!zoomRef) return;
    zoomRef.current = ready
      ? (step: number) => {
          const m = map.current;
          if (m) m.setLevel(Math.max(1, Math.min(14, m.getLevel() + step)), { animate: true });
        }
      : null;
  }, [ready, zoomRef]);

  // 내 위치 — 점은 위에, 정확도 원은 아래에. 위치가 바뀌면 옮기기만
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current) return;
    if (!me) {
      meDot.current?.setMap(null);
      meCircle.current?.setMap(null);
      meDot.current = null;
      meCircle.current = null;
      return;
    }
    const at = new maps.LatLng(me.lat, me.lng);
    // 정확도 원은 부정확할 때(accuracy 0 으로 넘김) 그리지 않는다 — 화면을 덮지 않게
    const radius = me.accuracy > 0 ? Math.max(me.accuracy, 10) : 0;
    if (!meDot.current) {
      meCircle.current = new maps.Circle({ center: at, radius: radius || 1, strokeWeight: 1, strokeColor: ME_COLOR, strokeOpacity: radius ? 0.4 : 0, fillColor: ME_COLOR, fillOpacity: radius ? 0.12 : 0, map: map.current });
      // 선택한 핀(1000)보다 아래 — 가게에 와 있어도 핀을 누를 수 있게
      meDot.current = new maps.CustomOverlay({ position: at, content: meElement(), map: map.current, xAnchor: 0.5, yAnchor: 0.5, zIndex: 500, clickable: false });
    } else {
      meDot.current.setPosition(at);
      meCircle.current?.setPosition(at);
      meCircle.current?.setRadius(radius || 1);
    }
    meCircle.current?.setOptions({ strokeOpacity: radius ? 0.4 : 0, fillOpacity: radius ? 0.12 : 0 });
  }, [ready, me]);

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
