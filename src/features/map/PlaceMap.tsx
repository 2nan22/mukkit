"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderBubble } from "@/components/ui/EatingLoader";
import { tierIconSvg } from "@/components/ui/TierIcon";
import type { Tier } from "@/domain/tier";

// 카카오맵 JS SDK 에서 쓰는 만큼만 — 공식 타입 패키지가 없다
type LatLng = object;
type KakaoMaps = {
  load(cb: () => void): void;
  Map: new (el: HTMLElement, opts: { center: LatLng; level: number }) => KakaoMapInstance;
  LatLng: new (lat: number, lng: number) => LatLng;
  LatLngBounds: new () => KakaoBounds;
  Point: new (x: number, y: number) => KakaoPoint;
  CustomOverlay: new (opts: {
    position: LatLng;
    content: HTMLElement;
    map?: KakaoMapInstance;
    xAnchor: number;
    yAnchor: number;
    zIndex: number;
    clickable: boolean;
  }) => KakaoOverlay;
  // 코스 길 (84)
  Polyline: new (opts: { path: LatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string; map?: KakaoMapInstance }) => KakaoPolyline;
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
  // 좌표 → 행정 구역 이름 (libraries=services)
  services?: {
    Geocoder: new () => {
      coord2RegionCode(lng: number, lat: number, cb: (res: { region_type: string; region_2depth_name: string; region_3depth_name: string }[], status: string) => void): void;
    };
  };
  MarkerClusterer?: new (opts: {
    map: KakaoMapInstance;
    averageCenter: boolean;
    minLevel: number;
    gridSize: number;
    minClusterSize: number;
    styles: Record<string, string>[];
  }) => KakaoClusterer;
};
type KakaoPolyline = { setMap(m: KakaoMapInstance | null): void };
type KakaoClusterer = { addMarkers(m: KakaoOverlay[]): void; clear(): void };
type KakaoLatLng = { getLat(): number; getLng(): number };
type KakaoPoint = { x: number; y: number };
type KakaoProjection = { pointFromCoords(p: LatLng): KakaoPoint; coordsFromPoint(p: KakaoPoint): LatLng };
type KakaoBounds = { extend(p: LatLng): void; contain(p: LatLng): boolean; getSouthWest(): KakaoLatLng; getNorthEast(): KakaoLatLng };
type KakaoCircle = { setMap(m: KakaoMapInstance | null): void; setPosition(p: LatLng): void; setRadius(r: number): void; setOptions(o: { strokeOpacity: number; fillOpacity: number }): void };
type KakaoMapInstance = {
  setBounds(b: object, top?: number, right?: number, bottom?: number, left?: number): void;
  getLevel(): number;
  setLevel(level: number, opts?: { animate?: boolean }): void;
  panTo(p: LatLng | KakaoBounds, padding?: number): void;
  getBounds(): KakaoBounds;
  getCenter(): KakaoLatLng;
  getProjection(): KakaoProjection;
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

// color: 리스트로 보기 — 리스트 색 핀(등급 숫자는 그대로) · text 는 그 색 위 글자색 · null 은 어느 리스트에도 없음(흰 빈 핀)
// order: 코스 순서 번호(1부터) — 등급 대신 주황 번호 핀 (84)
// kind meet: 약속 만날 곳 — 검정 원 깃발, label 은 읽어 주기용 · 누를 수 없음 (88-2)
export type Pin = { id: string; lat: number; lng: number; tier: Tier; kind?: "found" | "meet"; label?: string; color?: { bg: string; text: string } | null; order?: number };
export type MyLocation = { lat: number; lng: number; accuracy: number };
// 배열의 칸이 모두 같은 값(같은 참조)인지
function same(a: unknown[] | undefined, b: unknown[]): boolean {
  return Boolean(a) && a!.length === b.length && a!.every((v, i) => v === b[i]);
}

// 이 좌표의 구 · 동 (행정동) — SDK 가 아직 없거나 못 찾으면 null
export function regionName(lat: number, lng: number): Promise<{ gu: string; dong: string } | null> {
  const services = window.kakao?.maps.services;
  if (!services) return Promise.resolve(null);
  return new Promise((resolve) => {
    new services.Geocoder().coord2RegionCode(lng, lat, (res, status) => {
      const h = status === "OK" ? (res.find((r) => r.region_type === "H") ?? res[0]) : undefined;
      resolve(h?.region_2depth_name ? { gu: h.region_2depth_name, dong: h.region_3depth_name } : null);
    });
  });
}

export type MapViewport = { south: number; west: number; north: number; east: number; center: { lat: number; lng: number }; level: number; height: number };

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

const PIN_STYLE: Record<Tier, { size: number; bg: string; ring: string; text: string; label: string; dot?: string; icon?: { color: string } }> = {
  three: { size: 22, bg: "#b42330", ring: "#ffffff", text: "#ffffff", label: "3" },
  two: { size: 22, bg: "#e8590c", ring: "#ffffff", text: "#ffffff", label: "2" },
  one: { size: 22, bg: "#f5a524", ring: "#ffffff", text: "#3d2800", label: "1" },
  // 평가 아닌 핀은 등급 아이콘을 넣어 서로 갈리게 — 추천 안 함 회색 바탕 흰 숟가락 · 가고 싶은 곳 깃발 · 평가 전 빈 숟가락 (41)
  notRecommended: { size: 20, bg: "#8a8e96", ring: "#ffffff", text: "#ffffff", label: "", icon: { color: "#ffffff" } },
  wantToGo: { size: 20, bg: "#ffffff", ring: "#17181c", text: "#17181c", label: "", icon: { color: "#17181c" } },
  // 평가 전은 가장 많아 조금 작게 — 등급 핀이 먼저 보이게
  unrated: { size: 17, bg: "#ffffff", ring: "#5b5f69", text: "#5b5f69", label: "", icon: { color: "#5b5f69" } },
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

// 약속 만날 곳 — 검정 둥근 네모 + 흰 깃발 (가고 싶은 곳 흰 원 깃발 핀과 모양으로 구분, 91 검토) (코스 목록 만날 곳 줄과 같은 깃발). 이름은 목록이 말해 줌 — 이름표는 가게 핀을 덮어서 뺌 (88-2)
function meetElement(label: string): HTMLElement {
  const el = document.createElement("span");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `만날 곳 ${label}`);
  el.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:28px;height:28px;box-sizing:border-box;border-radius:8px;background:#17181c;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.25);color:#ffffff;pointer-events:none";
  el.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M6 21V4h11l-2 4 2 4H6"/></svg>';
  return el;
}

// 누를 수 없고 묶지 않는 핀 — 검색한 가게 · 만날 곳
const isStatic = (p: Pin) => p.kind === "found" || p.kind === "meet";

const NUMBER: Partial<Record<Tier, string>> = { three: "3", two: "2", one: "1" };

// 코스 번호 핀 — 브랜드 주황 원 + 흰 번호 (84)
const COURSE_COLOR = "#c8410b";
function orderElement(order: number, selected: boolean, onClick: () => void): HTMLElement {
  const size = selected ? 34 : 28;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `코스 ${order}번째 가게`);
  el.style.cssText = "padding:0;border:0;background:none;cursor:pointer";
  el.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${COURSE_COLOR};border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,.25);color:#ffffff;font:700 13px/1 system-ui">${order}</span>`;
  el.addEventListener("click", onClick);
  return el;
}

function pinContent(p: Pin, selected: boolean, onClick: () => void): HTMLElement {
  return p.order ? orderElement(p.order, selected, onClick) : pinElement(p.tier, selected, onClick, p.color);
}

function pinElement(tier: Tier, selected: boolean, onClick: () => void, color?: Pin["color"]): HTMLElement {
  const s: { size: number; bg: string; ring: string; text: string; label: string; dot?: string; icon?: { color: string } } =
    color === null
      ? { size: 14, bg: "#ffffff", ring: "#8a8e96", text: "#5b5f69", label: "" }
      : color
        ? { size: 20, bg: color.bg, ring: "#ffffff", text: color.text, label: NUMBER[tier] ?? "", dot: NUMBER[tier] ? undefined : color.text }
        : PIN_STYLE[tier];
  const size = selected ? s.size + 8 : s.size;
  // 빈 원 핀(평가 전)은 커져도 눈에 덜 띄어 검정 테두리로
  const ring = selected && tier === "unrated" ? "#17181c" : s.ring;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", "장소 선택");
  el.style.cssText = "padding:0;border:0;background:none;cursor:pointer";
  el.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${s.bg};border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,.25);color:${s.text};font:700 11px/1 system-ui">${s.icon ? tierIconSvg(tier, Math.round(size * (tier === "wantToGo" ? 0.55 : 0.6)), s.icon.color) : s.dot ? `<span style="width:${Math.round(size / 3)}px;height:${Math.round(size / 3)}px;border-radius:50%;background:${s.dot}"></span>` : s.label}</span>`;
  el.addEventListener("click", onClick);
  return el;
}

// 내 위치 색 — 장소 핀(빨강 · 주황 · 노랑 · 회색)과 겹치지 않는 지도 앱 관례의 파랑 (globals.css --color-me 와 같은 값)
const ME_COLOR = "#2f6fde";

// 평가한 곳이 평가 전 · 가고 싶은 곳 핀에 묻히지 않게 등급 높은 순으로 위에
const PIN_Z: Record<Tier, number> = { three: 400, two: 300, one: 250, notRecommended: 150, wantToGo: 120, unrated: 100 };
function zOf(tier: Tier, selected: boolean): number {
  return selected ? 1000 : PIN_Z[tier];
}
// 코스 번호 핀은 등급 핀 위 · 앞 번호가 위 — 고르거나 강조해도 같은 규칙 (84 검토)
function pinZ(p: Pin, selected: boolean): number {
  return p.order ? 600 - p.order + (selected ? 50 : 0) : zOf(p.tier, selected);
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

// 여백이 지도보다 크면 핀을 넣을 자리가 없어 가장 멀리(전국)로 물러난다 — 지도 크기의 60% 안으로 줄인다
export function fitPadding([top, right, bottom, left]: readonly [number, number, number, number], width: number, height: number): [number, number, number, number] {
  const shrink = (a: number, b: number, size: number) => {
    const room = size * 0.6;
    return size > 0 && a + b > room ? [(a * room) / (a + b), (b * room) / (a + b)] : [a, b];
  };
  const [t, b] = shrink(top, bottom, height);
  const [l, r] = shrink(left, right, width);
  return [Math.round(t), Math.round(r), Math.round(b), Math.round(l)];
}

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
  onViewChange,
  highlightId = null,
  centerOn = null,
  quiet = false,
  route = null,
  approach = null,
  fitPins = null,
}: {
  // 맞출 핀 — 없으면 pins 전체와 코스 길. 있으면 이 핀들만 (약속 지도: 코스와 다른 지역을 볼 때, 89)
  fitPins?: Pin[] | null;
  // 코스 길 [경도, 위도] — dashed 면 직선 어림(점선), 아니면 실제 걷는 길(실선) (84)
  route?: { path: [number, number][]; dashed: boolean } | null;
  // 만날 곳 › 1차 — 코스 길과 같은 주황, 흐린 점선 (88-2)
  approach?: [number, number][] | null;
  // 타일이 깔릴 때까지 가운데 로딩을 띄우지 않는다 — 홈 미리보기처럼 작은 지도
  quiet?: boolean;
  // 이 핀을 보이는 칸 가운데로 옮긴다(확대는 그대로) — 접힌 카드를 넘길 때. n 이 바뀌면 같은 핀도 다시
  centerOn?: { id: string; n: number } | null;
  pins: Pin[];
  // 고르지는 않고 눈에 띄게만 — 접힌 목록에서 맨 앞 카드의 핀
  highlightId?: string | null;
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
  // 지도가 멈출 때마다 지금 보이는 범위 · 가운데
  onViewChange?: (view: MapViewport) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<KakaoMapInstance | null>(null);
  const overlays = useRef<Map<string, { overlay: KakaoOverlay; pin: Pin }>>(new Map());
  const selectedRef = useRef<string | null>(selectedId);
  const highlightRef = useRef<string | null>(null);
  const fitted = useRef(false);
  const meDot = useRef<KakaoOverlay | null>(null);
  const meCircle = useRef<KakaoCircle | null>(null);
  const clusterer = useRef<KakaoClusterer | null>(null);
  const routeLine = useRef<KakaoPolyline | null>(null);
  const approachLine = useRef<KakaoPolyline | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // 마지막으로 지도에 반영한 값 — 다른 화면에 갔다 뒤로 돌아오면(화면이 숨었다 다시 보임) 효과가 다시 돌아도
  // 같은 값이면 지도를 옮기거나 핀을 다시 만들지 않는다 → 떠날 때의 위치 · 확대 그대로 (65)
  const applied = useRef<{ pins?: Pin[]; cluster?: boolean; fit?: unknown[]; focus?: unknown; pick?: unknown[]; center?: unknown }>({});
  // 첫 타일이 다 깔렸는지 — 그 전엔 빈 땅색 위에 로딩 (65)
  const [drawn, setDrawn] = useState(false);
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onUserMove);
  const onViewRef = useRef(onViewChange);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onMoveRef.current = onUserMove;
    onViewRef.current = onViewChange;
  }, [onSelect, onUserMove, onViewChange]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !el.current) return;
    if (!map.current) {
      map.current = new maps.Map(el.current, { center: new maps.LatLng(SEOUL.lat, SEOUL.lng), level: 8 });
      // 컨테이너 크기가 그려진 뒤에 지도 크기를 다시 맞춘다 — 안 하면 타일이 반만 깔린다
      const m0 = map.current;
      requestAnimationFrame(() => m0.relayout());
      window.kakao?.maps.event.addListener(m0, "dragstart", () => onMoveRef.current?.());
      window.kakao?.maps.event.addListener(m0, "tilesloaded", () => setDrawn(true));
      // 핀이 뜬 뒤에도 로딩이 핀을 오래 가리지 않게 — 타일이 늦어도 1.5초면 걷는다 (65 디자인 검토)
      setTimeout(() => setDrawn(true), 1500);
      window.kakao?.maps.event.addListener(m0, "idle", () => {
        const b = m0.getBounds();
        const sw = b.getSouthWest();
        const ne = b.getNorthEast();
        const c = m0.getCenter();
        onViewRef.current?.({ south: sw.getLat(), west: sw.getLng(), north: ne.getLat(), east: ne.getLng(), center: { lat: c.getLat(), lng: c.getLng() }, level: m0.getLevel(), height: el.current?.clientHeight ?? 0 });
      });
    }
    const m = map.current;
    if (applied.current.pins === pins && applied.current.cluster === cluster) return;
    applied.current.pins = pins;
    applied.current.cluster = cluster;
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
      // 고른 핀 · 강조 핀은 다시 만들 때도 크게
      const selected = p.id === selectedRef.current || p.id === highlightRef.current;
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(p.lat, p.lng),
        content: p.kind === "found" ? foundElement() : p.kind === "meet" ? meetElement(p.label ?? "") : pinContent(p, selected, () => onSelectRef.current(p.id)),
        map: useCluster && !isStatic(p) ? undefined : m,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: p.kind === "found" ? 1000 : p.kind === "meet" ? 900 : pinZ(p, selected),
        clickable: !isStatic(p),
      });
      next.set(p.id, { overlay, pin: p });
    }
    overlays.current = next;
    if (useCluster) clusterer.current?.addMarkers([...next.values()].filter((v) => !isStatic(v.pin)).map((v) => v.overlay));
  }, [ready, pins, cluster]);

  // 코스 길 — 바뀔 때만 다시 긋는다. 핀 아래에 깔리게 (Polyline 은 오버레이보다 아래 층)
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current) return;
    routeLine.current?.setMap(null);
    routeLine.current = null;
    if (!route || route.path.length < 2) return;
    routeLine.current = new maps.Polyline({
      path: route.path.map(([x, y]) => new maps.LatLng(y, x)),
      strokeWeight: route.dashed ? 4 : 5,
      strokeColor: COURSE_COLOR,
      strokeOpacity: route.dashed ? 0.7 : 0.85,
      strokeStyle: route.dashed ? "shortdash" : "solid",
      map: map.current,
    });
  }, [ready, route]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current) return;
    approachLine.current?.setMap(null);
    approachLine.current = null;
    if (!approach || approach.length < 2) return;
    approachLine.current = new maps.Polyline({
      path: approach.map(([x, y]) => new maps.LatLng(y, x)),
      strokeWeight: 4,
      strokeColor: COURSE_COLOR,
      strokeOpacity: 0.5,
      strokeStyle: "shortdash",
      map: map.current,
    });
  }, [ready, approach]);

  // 고른 핀 표시 — 이전 · 새 핀 두 개만 바꾼다
  useEffect(() => {
    const prev = selectedRef.current;
    selectedRef.current = selectedId;
    if (!ready || prev === selectedId) return;
    for (const id of [prev, selectedId]) {
      const hit = id ? overlays.current.get(id) : undefined;
      if (!hit || isStatic(hit.pin)) continue;
      const on = id === selectedId;
      hit.overlay.setContent(pinContent(hit.pin, on, () => onSelectRef.current(hit.pin.id)));
      hit.overlay.setZIndex(pinZ(hit.pin, on));
    }
  }, [ready, selectedId]);

  // 강조 핀 — 고른 핀처럼 크게 보이되 지도는 움직이지 않는다
  useEffect(() => {
    const prev = highlightRef.current;
    highlightRef.current = highlightId;
    if (!ready || prev === highlightId) return;
    for (const id of [prev, highlightId]) {
      const hit = id ? overlays.current.get(id) : undefined;
      if (!hit || isStatic(hit.pin) || id === selectedRef.current) continue;
      const on = id === highlightId;
      hit.overlay.setContent(pinContent(hit.pin, on, () => onSelectRef.current(hit.pin.id)));
      hit.overlay.setZIndex(pinZ(hit.pin, on));
    }
  }, [ready, highlightId]);

  // 핀을 지도 칸 가운데가 아니라 위 검색 · 아래 시트를 뺀 보이는 칸 가운데로
  const panToVisible = useCallback((lat: number, lng: number) => {
    const maps = window.kakao?.maps;
    const m = map.current;
    if (!maps || !m) return;
    const [t, r, b, l] = fitPadding(padding, el.current?.clientWidth ?? 0, el.current?.clientHeight ?? 0);
    const proj = m.getProjection();
    const at = proj.pointFromCoords(new maps.LatLng(lat, lng));
    m.panTo(proj.coordsFromPoint(new maps.Point(at.x + (r - l) / 2, at.y + (b - t) / 2)));
  }, [padding]);

  // 고른 장소로 다가간다 — 동네가 보일 만큼만 확대 · 그 가게가 보이는 칸 가운데로
  useEffect(() => {
    const maps = window.kakao?.maps;
    const pin = pins.find((p) => p.id === selectedId);
    if (!pin) applied.current.pick = undefined; // 닫았다가 같은 가게를 다시 고르면 다시 다가간다
    if (!ready || !maps || !map.current || !pin) return;
    if (same(applied.current.pick, [pin, selectedId])) return;
    applied.current.pick = [pin, selectedId];
    if (map.current.getLevel() > NEIGHBORHOOD_LEVEL) map.current.setLevel(NEIGHBORHOOD_LEVEL);
    panToVisible(pin.lat, pin.lng);
  }, [ready, pins, selectedId, panToVisible]);

  // 넘긴 카드의 가게를 가운데로 — 확대 수준은 그대로
  useEffect(() => {
    const pin = centerOn ? pins.find((p) => p.id === centerOn.id) : undefined;
    if (!ready || !pin || applied.current.center === centerOn) return;
    applied.current.center = centerOn;
    panToVisible(pin.lat, pin.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 넘길 때만 (핀 목록이 바뀔 때는 옮기지 않음)
  }, [ready, centerOn]);

  // 거르기가 바뀌면 보이는 핀이 다 들어오게 — hidden 이면 처음 한 번만, 이후엔 화면에 하나도 없을 때만 부드럽게
  const [top, right, bottom, left] = padding;
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current || pins.length === 0) return;
    const m = map.current;
    const key = [pins, top, right, bottom, left, refit, route, fitPins];
    if (same(applied.current.fit, key)) return;
    applied.current.fit = key;
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
      const list = fitPins && fitPins.length > 0 ? fitPins : pins;
      const line = fitPins && fitPins.length > 0 ? null : route;
      if (list.length === 1 && !line) {
        m.setLevel(SINGLE_LEVEL);
        m.setCenter(new maps.LatLng(list[0].lat, list[0].lng));
        return;
      }
      const bounds = new maps.LatLngBounds();
      list.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
      // 코스 길이 핀 바깥으로 돌아가도 다 보이게 (84)
      line?.path.forEach(([x, y]) => bounds.extend(new maps.LatLng(y, x)));
      const [t, r, b, l] = fitPadding([top, right, bottom, left], el.current?.clientWidth ?? 0, el.current?.clientHeight ?? 0);
      m.setBounds(bounds, t, r, b, l);
    });
  }, [ready, pins, top, right, bottom, left, refit, route, fitPins]);

  // 핀 맞춤보다 뒤에 돌도록 아래에 둔다 — 같은 프레임이면 이 위치가 이긴다
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !map.current || !focus) return;
    if (applied.current.focus === focus) return;
    applied.current.focus = focus;
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

  // 한 화면에 지도가 둘이면(약속 화면 코스 카드 + 추천 지역) next/script 는 먼저 붙은 쪽에만 onReady 를 준다 —
  // 나머지는 SDK 가 올라왔는지 직접 보고 시작한다 (88-4, 추천 지역 지도가 젓가락 로딩에 멈추던 것)
  useEffect(() => {
    if (ready || !APP_KEY) return;
    let left = 75;
    const t = setInterval(() => {
      if (window.kakao?.maps) {
        clearInterval(t);
        window.kakao.maps.load(() => setReady(true));
      } else if (--left <= 0) clearInterval(t);
    }, 200);
    return () => clearInterval(t);
  }, [ready]);

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
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&autoload=false&libraries=clusterer,services`}
        strategy="afterInteractive"
        onReady={() => {
          if (!window.kakao?.maps) return setFailed(true);
          window.kakao.maps.load(() => setReady(true));
        }}
        onError={() => setFailed(true)}
      />
      <div ref={el} className="isolate h-full w-full bg-map-land" aria-label="내 장소 지도" role="application" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-map-land">
          <span className="sr-only">지도를 불러오는 중이에요</span>
        </div>
      )}
      {!quiet && !drawn && (
        <div data-loading="" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <LoaderBubble label="지도를 불러오는 중" />
        </div>
      )}
    </>
  );
}
