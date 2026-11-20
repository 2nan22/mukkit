"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { Tier } from "@/domain/tier";

// 네이버 지도 v3 에서 쓰는 만큼만 — 공식 타입 패키지가 없다
type LatLng = object;
type NaverMaps = {
  Map: new (el: HTMLElement, opts: { center: LatLng; zoom: number; zoomControl?: boolean }) => NaverMapInstance;
  LatLng: new (lat: number, lng: number) => LatLng;
  LatLngBounds: new (sw: LatLng, ne: LatLng) => { extend(p: LatLng): void };
  Point: new (x: number, y: number) => object;
  Marker: new (opts: { position: LatLng; map: NaverMapInstance; icon: { content: string; anchor: object }; zIndex?: number }) => NaverMarker;
  Event: { addListener(target: object, name: string, fn: () => void): void };
};
type NaverMapInstance = { fitBounds(b: object, margin?: object): void; panTo(p: LatLng): void };
type NaverMarker = { setMap(m: NaverMapInstance | null): void };

declare global {
  interface Window {
    naver?: { maps: NaverMaps };
    navermap_authFailure?: () => void;
  }
}

export type Pin = { id: string; lat: number; lng: number; tier: Tier };

const KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID;
const SEOUL = { lat: 37.5665, lng: 126.978 };

const PIN_STYLE: Record<Tier, { size: number; bg: string; ring: string; text: string; label: string }> = {
  three: { size: 22, bg: "#b93a06", ring: "#ffffff", text: "#ffffff", label: "3" },
  two: { size: 22, bg: "#e8590c", ring: "#ffffff", text: "#ffffff", label: "2" },
  one: { size: 22, bg: "#f5a524", ring: "#ffffff", text: "#3d2800", label: "1" },
  notRecommended: { size: 14, bg: "#adb1b8", ring: "#ffffff", text: "#ffffff", label: "" },
  wantToGo: { size: 16, bg: "#ffffff", ring: "#5b5f69", text: "#5b5f69", label: "" },
  unrated: { size: 14, bg: "#ffffff", ring: "#adb1b8", text: "#5b5f69", label: "" },
};

function pinHtml(tier: Tier, selected: boolean): string {
  const s = PIN_STYLE[tier];
  const size = selected ? s.size + 8 : s.size;
  return `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${s.bg};border:${selected ? 3 : 2}px solid ${s.ring};box-shadow:0 2px 8px rgba(0,0,0,.18);color:${s.text};font:700 11px/1 system-ui">${s.label}</span>`;
}

export function NaverMap({ pins, selectedId, onSelect }: { pins: Pin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<NaverMapInstance | null>(null);
  const markers = useRef<NaverMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    window.navermap_authFailure = () => setFailed(true);
  }, []);

  useEffect(() => {
    const maps = window.naver?.maps;
    if (!ready || !maps || !el.current) return;
    if (!map.current) {
      map.current = new maps.Map(el.current, { center: new maps.LatLng(SEOUL.lat, SEOUL.lng), zoom: 12 });
    }
    const m = map.current;
    markers.current.forEach((mk) => mk.setMap(null));
    markers.current = pins.map((p) => {
      const selected = p.id === selectedId;
      const size = PIN_STYLE[p.tier].size + (selected ? 8 : 0);
      const marker = new maps.Marker({
        position: new maps.LatLng(p.lat, p.lng),
        map: m,
        icon: { content: pinHtml(p.tier, selected), anchor: new maps.Point(size / 2, size / 2) },
        zIndex: selected ? 1000 : p.tier === "three" ? 300 : p.tier === "two" ? 200 : 100,
      });
      maps.Event.addListener(marker, "click", () => onSelectRef.current(p.id));
      return marker;
    });
  }, [ready, pins, selectedId]);

  // 거르기가 바뀌면 보이는 핀이 다 들어오게
  useEffect(() => {
    const maps = window.naver?.maps;
    if (!ready || !maps || !map.current || pins.length === 0) return;
    const first = new maps.LatLng(pins[0].lat, pins[0].lng);
    const bounds = new maps.LatLngBounds(first, first);
    pins.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
    map.current.fitBounds(bounds, { top: 160, right: 40, bottom: 220, left: 40 });
  }, [ready, pins]);

  if (!KEY_ID || failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-map-land px-8 text-center">
        <p className="text-body font-bold">지도를 불러오지 못했어요</p>
        <p className="text-meta leading-normal text-muted">
          {KEY_ID
            ? "네이버 클라우드 Maps 인증에 실패했어요. 웹 서비스 URL 에 지금 주소가 등록돼 있는지 확인해 주세요."
            : "네이버 클라우드 Maps 키(NEXT_PUBLIC_NAVER_MAP_KEY_ID)가 아직 없어요. 아래 목록으로 볼 수 있어요."}
        </p>
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${KEY_ID}`}
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={el} className="h-full w-full bg-map-land" aria-label="내 장소 지도" role="application" />
    </>
  );
}
