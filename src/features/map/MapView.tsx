"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL, type Cuisine } from "@/domain/cuisine";
import { honor } from "@/domain/honor";
import { regionOf } from "@/domain/region";
import { TIER_LABEL, type Tier } from "@/domain/tier";
import { SOURCE_LABEL } from "@/features/import/sources";
import { SourceMark } from "@/components/brand/BrandLogo";
import { PlaceMap, type MapViewport, type MyLocation } from "./PlaceMap";
import { PeekCards, type NearPlace } from "./PeekCards";
import { PlaceThumb } from "@/components/ui/PlaceThumb";
import { loadPlaceCovers } from "@/features/place/coverActions";
import { MapSearch } from "./MapSearch";
import { openKakaoPlace, type NewPlaceHit } from "@/features/search/actions";
import { ratersLine, type MapPlace } from "./myPlaces";
import { Avatar } from "@/components/ui/Avatar";

const TIER_FILTERS: Tier[] = ["three", "two", "one", "notRecommended", "wantToGo", "unrated"];
// 팔로잉 지도는 평가한 곳만이라 평가 등급만
const RATED_FILTERS: Tier[] = ["three", "two", "one", "notRecommended"];
const TIER_DOT: Record<Tier, string> = {
  three: "bg-tier-3",
  two: "bg-pin-2",
  one: "bg-pin-1",
  notRecommended: "bg-pin-none",
  wantToGo: "border border-ink-2 bg-white",
  unrated: "border border-pin-none bg-white",
};
const CUISINE_ORDER: Cuisine[] = ["korean", "chinese", "japanese", "western", "asian", "snack", "chicken", "bar", "cafe", "other", "nonFood"];

type Focus = { lat: number; lng: number; level: number };
type Snap = "peek" | "half" | "full";
// 목록 높이 — 접힘 · 중간 · 펼침 (화면 높이 대비)
// 펼침은 칩 줄 · 머리줄 · 하단 탭 자리를 남긴다 — 작은 화면에서 칩을 덮지 않게
const CHROME_PX = 300;
const SNAP_CLASS: Record<Snap, string> = { peek: "h-0", half: "h-[40dvh]", full: "h-[min(68dvh,calc(100dvh-300px))]" };
function snapPx(s: Snap): number {
  const vh = window.innerHeight;
  return s === "peek" ? 0 : s === "half" ? vh * 0.4 : Math.max(vh * 0.4, Math.min(vh * 0.68, vh - CHROME_PX));
}
const ORDER: Snap[] = ["peek", "half", "full"];
const ME_ACCURACY_MAX = 300;
const TAP_SLOP = 6;
const AREA_LEVEL = 6;
const HERE_LEVEL = 5;
const PICK_LEVEL = 4;
const FOUND_PIN = "found";
// 지도 위쪽 검색창 · 칩이 덮는 높이
const TOP_COVER_PX = 110;
// 목록을 펼친 동안엔 접힌 시트 높이로 셈 — 목록이 출렁이지 않게
const PEEK_COVER_PX = 165;

// 처음 열 때 — 가장 많이 저장한 지역(시 · 구)의 가운데
function busiestArea(places: MapPlace[]): Focus | null {
  const byRegion = new Map<string, MapPlace[]>();
  for (const p of places) {
    const r = regionOf(p.address);
    if (r) byRegion.set(r, [...(byRegion.get(r) ?? []), p]);
  }
  const top = [...byRegion.values()].sort((a, b) => b.length - a.length)[0];
  if (!top) return null;
  return { lat: top.reduce((n, p) => n + p.lat, 0) / top.length, lng: top.reduce((n, p) => n + p.lng, 0) / top.length, level: AREA_LEVEL };
}

// view: mine 내 장소 · following 팔로우하는 사람이 평가한 곳 (following: 팔로우 수 — 빈 화면 안내)
export function MapView({
  places: allPlaces,
  initialTiers = [],
  at = null,
  view = "mine",
  following = 0,
}: {
  places: MapPlace[];
  initialTiers?: Tier[];
  at?: { lat: number; lng: number } | null;
  view?: "mine" | "following";
  following?: number;
}) {
  const isFollowing = view === "following";
  // 팔로잉 지도 사람 거르기 — 고른 사람의 평가만 남기고, 핀 색도 그 사람들 중 가장 높은 등급으로
  const [people, setPeople] = useState<string[]>([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const peopleSheet = useRef<HTMLElement>(null);
  useEffect(() => {
    if (peopleOpen) peopleSheet.current?.focus();
  }, [peopleOpen]);
  const places = useMemo(
    () =>
      people.length === 0
        ? allPlaces
        : allPlaces.flatMap((p) => {
            const rs = (p.raters ?? []).filter((r) => people.includes(r.userId));
            return rs.length ? [{ ...p, raters: rs, tier: rs[0].tier }] : [];
          }),
    [allPlaces, people],
  );
  // 지도에 나온 팔로잉 — 평가한 곳 많은 순
  const raterList = useMemo(() => {
    const m = new Map<string, { userId: string; nickname: string; count: number }>();
    for (const p of allPlaces) for (const r of p.raters ?? []) m.set(r.userId, { userId: r.userId, nickname: r.nickname, count: (m.get(r.userId)?.count ?? 0) + 1 });
    return [...m.values()].sort((a, b) => b.count - a.count || a.nickname.localeCompare(b.nickname));
  }, [allPlaces]);
  const firstPicked = raterList.find((r) => r.userId === people[0])?.nickname ?? "";
  const peopleLabel = people.length === 0 ? "사람" : people.length === 1 ? firstPicked : `사람 ${people.length}`;
  // 목록 제목 — 고른 사람이 있으면 그 사람 기준으로
  const whoseLabel = people.length === 0 ? "팔로잉이" : people.length === 1 ? `${honor(firstPicked)}이` : `고른 ${people.length}명이`;
  // 팔로잉 지도는 누군가 그 등급을 줬으면 해당 (핀 색은 가장 높은 등급)
  const tierMatch = (p: MapPlace, ts: Tier[]) => ts.length === 0 || (p.raters ? p.raters.some((r) => ts.includes(r.tier)) : ts.includes(p.tier));
  // 리스트 하나만 볼 때는 전체 맞춤, 아니면 위치 · 많이 저장한 지역에서 시작
  const [focus, setFocus] = useState<Focus | null>(() => (at ? { ...at, level: HERE_LEVEL } : places.length > 30 ? busiestArea(places) : null));
  const [locating, setLocating] = useState(false);
  const [me, setMe] = useState<MyLocation | null>(null);
  // 내 위치가 지도 가운데일 때만 버튼을 파랗게 — 지도를 손으로 옮기면 해제
  const [centered, setCentered] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  // 처음 누르면 위치를 따라가기 시작하고 그 자리로, 다시 누르면 내 위치로 돌아오기
  function startWatch(recenter: boolean) {
    let first = recenter;
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setLocating(false);
        setMe({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy });
        if (first) {
          setFocus({ lat: coords.latitude, lng: coords.longitude, level: HERE_LEVEL });
          setCentered(true);
        }
        first = false;
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED ? "위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요" : "지금은 위치를 찾을 수 없어요");
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }
  function goHere() {
    if (me) {
      setCentered(true);
      return setFocus({ lat: me.lat, lng: me.lng, level: HERE_LEVEL });
    }
    if (!navigator.geolocation) return setLocError("이 브라우저에서는 위치를 쓸 수 없어요");
    setLocating(true);
    setLocError(null);
    startWatch(true);
  }
  // 지도 탭을 떠나거나 화면이 가려지면 위치 따라가기를 멈춘다 (배터리) — 돌아오면 다시
  const watching = me !== null;
  useEffect(() => {
    if (!watching) return;
    const onVisible = () => {
      if (document.hidden) {
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      } else if (watchId.current === null) startWatch(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [watching]);
  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );
  useEffect(() => {
    if (!locError) return;
    const t = setTimeout(() => setLocError(null), 5000);
    return () => clearTimeout(t);
  }, [locError]);
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 지도 검색으로 찾은 새 가게 — 임시 핀 · 아래 카드
  const [found, setFound] = useState<NewPlaceHit | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const zoomRef = useRef<((step: number) => void) | null>(null);
  // 지금 지도에 보이는 범위 — 접힌 목록 카드가 따른다
  // bottomCover: 지도가 멈춘 순간 접힌 시트가 덮은 높이 (이벤트에서 잰다)
  const [viewport, setViewport] = useState<(MapViewport & { bottomCover: number }) | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  // 카드 · 목록의 대표 사진 — 화면에 나온 곳만 한 번씩 묻는다
  const [covers, setCovers] = useState<Record<string, string>>({});
  const askedCovers = useRef(new Set<string>());
  function pickMine(placeId: string) {
    const p = places.find((x) => x.placeId === placeId);
    if (!p) return;
    // 거르기 때문에 안 보이는 곳이면 거르기를 풀고 보여 준다
    if (!(tierMatch(p, tiers) && (cuisines.length === 0 || cuisines.includes(p.cuisine)))) {
      setTiers([]);
      setCuisines([]);
    }
    setFound(null);
    setSelectedId(placeId);
    setFocus({ lat: p.lat, lng: p.lng, level: PICK_LEVEL });
  }
  function pickNew(hit: NewPlaceHit) {
    setSelectedId(null);
    setFound(hit);
    setFocus({ lat: hit.lat, lng: hit.lng, level: PICK_LEVEL });
  }
  const [filterOpen, setFilterOpen] = useState(false);
  const [snap, setSnap] = useState<Snap>(process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ? "peek" : "half");
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useRef<{ y: number; h: number; t: number; moved: boolean } | null>(null);
  const frame = useRef(0);

  // 시트 끌기 — 손잡이 · 머리줄에서 누르면 화면 어디로 움직여도 따라간다
  // 끄는 동안은 목록 높이만 직접 바꾸고(다시 그리기 없음), 놓으면 가까운 단계(빠르게 밀면 그 방향)로
  function onSheetDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const list = listRef.current;
    if (!list) return;
    drag.current = { y: e.clientY, h: list.offsetHeight, t: e.timeStamp, moved: false };
    const move = (ev: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dy = d.y - ev.clientY;
      if (!d.moved && Math.abs(dy) < TAP_SLOP) return;
      d.moved = true;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        list.style.transition = "none";
        list.style.height = `${Math.max(0, Math.min(snapPx("full"), d.h + dy))}px`;
      });
    };
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      cancelAnimationFrame(frame.current);
      const d = drag.current;
      drag.current = null;
      list.style.transition = "";
      list.style.height = "";
      if (!d?.moved) return;
      // 끌고 놓은 자리에서 이어지는 클릭(목록 보기 버튼 등)은 한 번 무시
      const swallow = (c: MouseEvent) => (c.preventDefault(), c.stopPropagation());
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true), 300);
      const h = Math.max(0, d.h + (d.y - ev.clientY));
      const speed = (d.y - ev.clientY) / Math.max(1, ev.timeStamp - d.t);
      const nearest = ORDER.reduce((a, b) => (Math.abs(snapPx(b) - h) < Math.abs(snapPx(a) - h) ? b : a));
      const from = ORDER.reduce((a, b) => (Math.abs(snapPx(b) - d.h) < Math.abs(snapPx(a) - d.h) ? b : a));
      const step = speed > 0.5 ? 1 : speed < -0.5 ? -1 : 0;
      // 빠르게 밀면 최소 한 단계, 멀리 끌었으면 가까운 단계까지
      const stepped = ORDER.indexOf(from) + step;
      const target = step > 0 ? Math.max(stepped, ORDER.indexOf(nearest)) : step < 0 ? Math.min(stepped, ORDER.indexOf(nearest)) : ORDER.indexOf(nearest);
      setSnap(ORDER[Math.max(0, Math.min(2, target))]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }
  const listOpen = snap !== "peek";
  const up1 = (s: Snap) => ORDER[Math.min(2, ORDER.indexOf(s) + 1)];
  const down1 = (s: Snap) => ORDER[Math.max(0, ORDER.indexOf(s) - 1)];

  const shown = useMemo(
    () =>
      places.filter(
        (p) => tierMatch(p, tiers) && (cuisines.length === 0 || cuisines.includes(p.cuisine)),
      ),
    [places, tiers, cuisines],
  );
  const pins = useMemo(
    () => [
      ...shown.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, tier: p.tier })),
      ...(found ? [{ id: FOUND_PIN, lat: found.lat, lng: found.lng, tier: "unrated" as const, kind: "found" as const }] : []),
    ],
    [shown, found],
  );
  // 보이는 지도 안의 내 장소 · 보이는 가운데에서 가까운 순
  // 위 검색창 · 칩, 아래 접힌 시트에 가려진 줄은 뺀다
  const inView = useMemo((): NearPlace[] => {
    if (!viewport || !viewport.height) return [];
    const { south, west, north, east, height, bottomCover } = viewport;
    const span = north - south;
    const top = north - span * (TOP_COVER_PX / height);
    const bottom = south + span * (bottomCover / height);
    const center = { lat: (top + bottom) / 2, lng: (west + east) / 2 };
    const k = Math.cos((center.lat * Math.PI) / 180);
    const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * k) * 111_000;
    return shown
      .filter((p) => p.lat >= bottom && p.lat <= top && p.lng >= west && p.lng <= east)
      .sort((a, b) => meters(a, center) - meters(b, center))
      .map((p) => ({ ...p, meters: me ? meters(p, me) : null }));
  }, [shown, viewport, me]);
  // 펼친 목록도 화면 안 · 가까운 순 (지도가 아직 안 떴으면 전체)
  const listed: MapPlace[] = viewport ? inView : shown;
  const filtered = tiers.length > 0 || cuisines.length > 0 || people.length > 0;
  const resetFilters = () => (setTiers([]), setCuisines([]), setPeople([]));
  const coverKey = listed.slice(0, 20).map((p) => p.placeId).join(",");
  useEffect(() => {
    const ids = coverKey ? coverKey.split(",").filter((id) => !askedCovers.current.has(id)) : [];
    if (ids.length === 0) return;
    const t = setTimeout(async () => {
      ids.forEach((id) => askedCovers.current.add(id));
      const got = await loadPlaceCovers(ids).catch(() => ({}));
      if (Object.keys(got).length) setCovers((c) => ({ ...c, ...got }));
    }, 250);
    return () => clearTimeout(t);
  }, [coverKey]);
  const presentCuisines = CUISINE_ORDER.filter((c) => places.some((p) => p.cuisine === c));
  const selected = shown.find((p) => p.placeId === selectedId) ?? null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="absolute inset-0">
        <PlaceMap
          pins={pins}
          selectedId={selected?.placeId ?? (found ? FOUND_PIN : null)}
          onSelect={(id) => (id === FOUND_PIN ? undefined : (setFound(null), setSelectedId(id)))}
          zoomRef={zoomRef}
          onViewChange={(v) => setViewport({ ...v, bottomCover: snap === "peek" ? (sheetRef.current?.offsetHeight ?? 0) : PEEK_COVER_PX })}
          cluster
          focus={focus}
          refit="hidden"
          me={me && me.accuracy <= ME_ACCURACY_MAX ? me : me ? { ...me, accuracy: 0 } : null}
          onUserMove={() => setCentered(false)}
        />
      </div>

      <div className="pointer-events-none relative z-20 flex flex-col gap-1 pt-2">
        <MapSearch
          places={places}
          onPickMine={pickMine}
          onPickNew={pickNew}
          onOpenChange={setSearchOpen}
          onClear={() => setFound(null)}
          mineLabel={isFollowing ? "팔로잉이 평가한 곳" : undefined}
          freshLabel={isFollowing ? "팔로잉이 평가하지 않은 가게" : undefined}
        />
        <div className={searchOpen || (isFollowing && allPlaces.length === 0) ? "invisible" : ""}>
        <ChipRow label="거르기">
          {isFollowing && raterList.length > 1 && (
            <>
              <Chip pressed={people.length > 0} onClick={() => setPeopleOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
                </svg>
                <span className="max-w-[8rem] truncate">{peopleLabel}</span>
              </Chip>
              {people.length > 0 && (
                <button type="button" onClick={() => setPeople([])} aria-label="사람 거르기 풀기" className="-ml-1 flex h-11 w-8 shrink-0 items-center justify-center">
                  <span className="flex size-6 items-center justify-center rounded-full bg-white text-ink shadow-float">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </span>
                </button>
              )}
              <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 self-center bg-line-strong" />
            </>
          )}
          <Chip pressed={tiers.length === 0 && people.length === 0} onClick={() => (setTiers([]), setPeople([]))}>
            전체
          </Chip>
          {(isFollowing ? RATED_FILTERS : TIER_FILTERS).map((t) => (
            <Chip key={t} pressed={tiers.includes(t)} onClick={() => setTiers(toggle(tiers, t))}>
              <span aria-hidden="true" className={`size-2 rounded-full ${TIER_DOT[t]}`} />
              {TIER_LABEL[t]}
            </Chip>
          ))}
          <Chip pressed={cuisines.length > 0} onClick={() => setFilterOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {cuisines.length > 0 ? `음식 종류 ${cuisines.length}` : "음식 종류"}
          </Chip>
        </ChipRow>
        </div>
      </div>

      {peopleOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={() => setPeopleOpen(false)}>
          <section
            ref={peopleSheet}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="사람 고르기"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setPeopleOpen(false)}
            className="flex max-h-[80dvh] w-full max-w-[480px] flex-col gap-3 rounded-t-[20px] bg-white px-5 outline-none pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between">
              <h2 className="text-section font-bold">누구의 평가를 볼까요?</h2>
              {people.length > 0 && (
                <button type="button" onClick={() => setPeople([])} className="h-11 text-meta text-muted">
                  초기화
                </button>
              )}
            </div>
            <ul className="-mx-5 flex flex-col overflow-y-auto px-5">
              {raterList.map((r) => {
                const on = people.includes(r.userId);
                return (
                  <li key={r.userId}>
                    <button type="button" aria-pressed={on} onClick={() => setPeople(toggle(people, r.userId))} className="flex h-12 w-full items-center gap-3 text-left">
                      <Avatar name={r.nickname} size={32} />
                      <span className={`min-w-0 flex-1 truncate text-body ${on ? "font-bold" : ""}`}>{r.nickname}</span>
                      <span className="text-meta text-muted">{r.count}곳</span>
                      <span aria-hidden="true" className={`flex size-6 items-center justify-center rounded-full ${on ? "bg-ink text-white" : "border border-line-strong"}`}>
                        {on && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              disabled={shown.length === 0}
              onClick={() => setPeopleOpen(false)}
              className="h-btn-l shrink-0 rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand disabled:bg-surface disabled:text-subtle disabled:shadow-none"
            >
              {shown.length > 0 ? `${shown.length}곳 보기` : "평가한 곳이 없어요"}
            </button>
          </section>
        </div>
      )}

      {filterOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={() => setFilterOpen(false)}>
          <section
            role="dialog"
            aria-label="음식 종류"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[480px] flex-col gap-4 rounded-t-[20px] bg-white px-5 pt-3 pb-6"
          >
            <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between">
              <h2 className="text-section font-bold">음식 종류</h2>
              {cuisines.length > 0 && (
                <button type="button" onClick={() => setCuisines([])} className="h-9 text-meta text-muted">
                  초기화
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presentCuisines.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cuisines.includes(c)}
                  onClick={() => setCuisines(toggle(cuisines, c))}
                  className={`h-9 rounded-full px-3.5 text-meta font-medium ${cuisines.includes(c) ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
                >
                  {CUISINE_LABEL[c]} <span className="opacity-60">{places.filter((p) => p.cuisine === c).length}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setFilterOpen(false)} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
              {shown.length}곳 보기
            </button>
          </section>
        </div>
      )}

      <div className="flex-1" />

      <section ref={sheetRef} className={`relative z-10 rounded-t-2xl bg-white px-5 shadow-sheet ${snap === "peek" && !selected && !found ? "pb-3" : "pb-5"}`}>
        {!(snap === "full" && !selected) && (
          <div className="absolute right-4 bottom-full mb-3 flex flex-col items-end gap-2">
            {locError && (
              <p role="status" className="max-w-60 rounded-[12px] bg-ink px-3 py-2 text-meta leading-normal text-white shadow-float">
                {locError}
              </p>
            )}
            {/* 확대 · 축소 — 내 위치 버튼 위, 시트와 같이 움직인다 */}
            <div className="flex flex-col overflow-hidden rounded-[12px] bg-white shadow-float">
              {([
                ["확대", -1, "M12 5v14M5 12h14"],
                ["축소", 1, "M5 12h14"],
              ] as const).map(([label, step, d], i) => (
                <button key={label} type="button" aria-label={label} onClick={() => zoomRef.current?.(step)} className={`flex size-11 items-center justify-center text-ink ${i === 0 ? "border-b border-line" : ""}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d={d} />
                  </svg>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={goHere}
              disabled={locating}
              aria-busy={locating}
              aria-label={locating ? "내 위치 찾는 중" : me ? "내 위치로 돌아가기" : "내 위치 보기"}
              className={`flex size-11 items-center justify-center rounded-full bg-white shadow-float ${me && centered ? "text-me" : "text-ink"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className={locating ? "animate-pulse" : ""}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
          </div>
        )}
        {isFollowing && allPlaces.length === 0 ? (
          <div className="flex flex-col items-start gap-2 pt-5 pb-1">
            <span className="text-body font-bold">{following > 0 ? "팔로잉이 평가한 곳이 아직 없어요" : "아직 팔로우한 사람이 없어요"}</span>
            <span className="text-meta text-muted">{following > 0 ? "팔로우한 사람이 공개한 평가만 보여요." : "취향이 비슷한 사람을 팔로우하면 그 사람의 평가가 지도에 모여요."}</span>
            <Link href="/people" className="mt-1 flex h-11 items-center rounded-full bg-brand-soft px-4 text-meta font-bold text-brand">
              사람 찾기
            </Link>
          </div>
        ) : selected ? (
          <div className="pt-4">
            {isFollowing ? <FollowingCard place={selected} onClose={() => setSelectedId(null)} /> : <PlaceCard place={selected} onClose={() => setSelectedId(null)} />}
          </div>
        ) : found ? (
          <div className="pt-4">
            <FoundCard hit={found} onClose={() => setFound(null)} />
          </div>
        ) : (
          <>
            <div onPointerDown={onSheetDown} className="-mx-5 touch-none px-5 select-none [-webkit-touch-callout:none]">
              <button
                type="button"
                aria-label={snap === "full" ? "목록 줄이기" : "목록 더 펼치기"}
                onClick={() => setSnap(snap === "full" ? "half" : up1(snap))}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  setSnap(e.key === "ArrowUp" ? up1(snap) : down1(snap));
                }}
                className="mx-auto flex h-6 w-16 items-center justify-center"
              >
                <span aria-hidden="true" className="h-1 w-9 rounded-full bg-line-strong" />
              </button>
              <div className="flex items-center justify-between">
                <span className="text-body font-bold">
                  {!viewport ? `${shown.length}곳` : inView.length ? (isFollowing ? `${whoseLabel} 평가한 곳 ${inView.length}곳` : `이 화면에 ${inView.length}곳`) : isFollowing ? "이 화면에 팔로잉이 평가한 곳이 없어요" : "이 화면에 저장한 곳이 없어요"}
                </span>
                <button type="button" onClick={() => setSnap(snap === "peek" ? "half" : "peek")} aria-expanded={listOpen} className="h-btn-m text-meta text-ink-2">
                  {listOpen ? "목록 닫기" : "목록 보기"}
                </button>
              </div>
            </div>
            {snap === "peek" &&
              viewport &&
              (inView.length > 0 ? (
                <PeekCards places={inView} covers={covers} onPick={(id) => (setFound(null), setSelectedId(id))} onMore={() => setSnap("half")} />
              ) : (
                <EmptyHere filtered={filtered} onReset={resetFilters} />
              ))}
            <ul
              ref={listRef}
              inert={!listOpen}
              className={`overflow-y-auto overscroll-contain transition-[height] duration-200 ease-out ${SNAP_CLASS[snap]}`}
            >
              {listed.length === 0 && (
                <li>
                  <EmptyHere filtered={filtered} onReset={resetFilters} />
                </li>
              )}
              {listed.map((p) => (
                <li key={p.placeId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.placeId)}
                    className="flex min-h-16 w-full items-center gap-3 border-b border-line py-2 text-left"
                  >
                    <PlaceThumb src={covers[p.placeId]} cuisine={p.cuisine} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body font-semibold">{p.name}</span>
                      <span className="truncate text-meta text-muted">{p.raters ? `${ratersLine(p.raters)} · ${placeMeta(p)}` : placeMeta(p)}</span>
                    </span>
                    {p.raters && p.raters.length > 1 ? <span className="shrink-0 text-meta text-muted">{p.raters.length}명 평가</span> : <TierBadge tier={p.tier} />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

// 보이는 지도에 저장한 곳이 없을 때 — 거르기가 켜져 있으면 지우기
function EmptyHere({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <div className="flex h-16 items-center gap-3 text-meta text-muted">
      {filtered ? (
        <>
          조건에 맞는 곳이 없어요
          <button type="button" onClick={onReset} className="h-11 text-meta font-semibold text-ink underline underline-offset-[3px]">
            조건 지우기
          </button>
        </>
      ) : (
        "지도를 축소하면 더 보여요"
      )}
    </div>
  );
}

// 지도 검색으로 찾은, 아직 저장하지 않은 가게
function FoundCard({ hit, onClose }: { hit: NewPlaceHit; onClose: () => void }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    if (hit.placeId) return router.push(`/p/${hit.placeId}`);
    setOpening(true);
    const res = await openKakaoPlace({ kakaoId: hit.kakaoId, name: hit.name, lat: hit.lat, lng: hit.lng });
    setOpening(false);
    if (res.placeId) router.push(`/p/${res.placeId}`);
    else setError(res.error ?? "장소를 열지 못했어요");
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-section font-bold">{hit.name}</span>
          <span className="truncate text-meta text-muted">{hit.meta}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      <button type="button" disabled={opening} onClick={open} className="mt-2 flex h-btn-m items-center justify-center rounded-btn-m bg-brand text-body font-bold text-white raised-brand disabled:opacity-60">
        {opening ? "여는 중" : "장소 보기"}
      </button>
    </div>
  );
}

function PlaceCard({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <Link href={`/p/${place.placeId}`} className="truncate text-section font-bold underline-offset-[3px] hover:underline">
              {place.name}
            </Link>
            <TierBadge tier={place.tier} />
          </span>
          <span className="text-meta text-muted">
            {placeMeta(place)}
            {!place.available && " · 지도에 정보 없음"}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {place.note && (
        <p className="rounded-btn-s bg-surface px-3 py-2.5 text-meta leading-normal text-ink-2">
          <span className="text-muted">내 메모</span> · {place.note}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 pt-2">
        {place.links[0] ? (
          <a
            href={place.links[0].url}
            target="_blank"
            rel="noreferrer"
            className="flex h-btn-m items-center justify-center gap-2 rounded-btn-m border border-line-strong text-body text-ink"
          >
            <SourceMark source={place.links[0].source} />
            {SOURCE_LABEL[place.links[0].source]}에서 보기
          </a>
        ) : (
          <span />
        )}
        <Link
          href={`/rate/${place.placeId}?next=/map`}
          className="flex h-btn-m items-center justify-center rounded-btn-m bg-brand text-body font-bold text-white raised-brand"
        >
          {["three", "two", "one", "notRecommended"].includes(place.tier) ? "평가 수정" : "평가하기"}
        </Link>
      </div>
    </div>
  );
}

// 팔로잉 지도 카드 — 누가 어떤 등급을 줬는지 (평균 없음), 장소 보기
function FollowingCard({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  const raters = place.raters ?? [];
  const SHOW = 3;
  const [all, setAll] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-section font-bold">{place.name}</h2>
          <span className="text-meta text-muted">
            {placeMeta(place)}
            {!place.available && " · 지도에 정보 없음"}
          </span>
          {place.myTier && <span className="text-meta text-ink-2">{["three", "two", "one", "notRecommended"].includes(place.myTier) ? `내 평가 ${TIER_LABEL[place.myTier]}` : "내가 저장한 곳"}</span>}
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <ul aria-label="평가한 사람" className={`flex flex-col ${all ? "max-h-56 overflow-y-auto" : ""}`}>
        {(all ? raters : raters.slice(0, SHOW)).map((r) => (
          <li key={r.userId}>
            <Link href={`/p/${place.placeId}/r/${r.userId}`} aria-label={`${r.nickname} ${TIER_LABEL[r.tier]} 평가 보기`} className="flex h-11 items-center gap-2.5">
              <Avatar name={r.nickname} size={24} />
              <span className="min-w-0 flex-1 truncate text-body">{r.nickname}</span>
              <TierBadge tier={r.tier} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-subtle">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
      {raters.length > SHOW && !all && (
        <button type="button" onClick={() => setAll(true)} className="flex h-11 items-center text-meta font-semibold text-ink-2">
          전체 {raters.length}명 보기
        </button>
      )}
      <Link
        href={`/p/${place.placeId}`}
        className="mt-2 flex h-btn-m items-center justify-center rounded-btn-m bg-brand text-body font-bold text-white raised-brand"
      >
        장소 보기
      </Link>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="pointer-events-auto flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
      {children}
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className="flex h-11 shrink-0 items-center">
      <span
        className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-meta whitespace-nowrap shadow-float ${
          pressed ? "bg-ink font-bold text-white" : "bg-white text-ink"
        }`}
      >
        {children}
      </span>
    </button>
  );
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function placeMeta(p: MapPlace): string {
  const region = p.address.split(" ").slice(0, 2).join(" ");
  return [...new Set([CUISINE_LABEL[p.cuisine], p.categoryName, region])].filter((v) => v && v !== "음식점").join(" · ");
}
