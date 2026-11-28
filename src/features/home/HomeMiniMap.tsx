"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TierIcon, TierSpoons } from "@/components/ui/TierIcon";
import { densestFocus, nearMeFocus, type MapFocus } from "@/domain/mapFocus";
import { PlaceMap, regionName, type MapViewport, type MyLocation, type Pin } from "@/features/map/PlaceMap";
import { countInView, type ViewCounts } from "./countInView";
import { regionLabel } from "./regionLabel";
import type { HomePoint } from "./myHome";

const PADDING = [24, 24, 24, 24] as const;
const noop = () => {};

// 홈 내 지도 — 실제 카카오맵 미리보기. 화면에 들어올 때만 지도를 띄우고(SDK · 쿼터 아끼기),
// inert 로 만지거나 포커스가 들어가지 않게 — 카드 전체를 덮은 링크가 지도 탭으로
// 처음 보이는 곳: 위치 권한을 이미 줬고 둘레 3km 에 내 장소가 있으면 지금 위치, 아니면 장소가 가장 많이 모인 동네 (50)
// 홈 데이터가 새로 오면(새로 고침 · 오가기) 핀 배열이 바뀌어도 전체로 다시 맞추지 않는다 — refit hidden (96-3)
// 지도 위에 보이는 동네 이름(좁으면 구 · 동, 넓으면 구), 아래 숫자는 지도에 보이는 범위 기준 — 그 전엔 전체 (65)
export function HomeMapCard({ points, total }: { points: HomePoint[]; total: ViewCounts }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [me, setMe] = useState<MyLocation | null>(null);
  const [view, setView] = useState<MapViewport | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const pins: Pin[] = useMemo(() => points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, tier: p.tier })), [points]);
  const counts = view ? countInView(points, view) : total;

  useEffect(() => {
    const el = box.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setFocus(densestFocus(points, el.clientWidth));
        setSeen(true);
        // 권한을 묻지는 않는다 — 이미 허용한 경우만
        navigator.permissions
          ?.query({ name: "geolocation" })
          .then((p) => {
            if (p.state !== "granted") return;
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const near = nearMeFocus(here, points, el.clientWidth);
                if (!near) return;
                setMe({ ...here, accuracy: pos.coords.accuracy });
                setFocus(near);
              },
              () => undefined,
              { maximumAge: 10 * 60 * 1000, timeout: 5000 },
            );
          })
          .catch(() => undefined);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, points]);

  // 지도가 멈출 때마다 — 가운데 동네 이름 (내 위치로 열렸으면 내 위치 기준)
  // 첫 위치로 옮기기 전(SDK 기본 위치)에 오는 멈춤은 버린다 · 늦게 온 이름 응답은 버린다
  const settled = useRef(false);
  const asked = useRef(0);
  const onView = useCallback(
    (v: MapViewport) => {
      if (!settled.current) {
        if (!focus || Math.abs(v.center.lat - focus.lat) > 0.002 || Math.abs(v.center.lng - focus.lng) > 0.002) return;
        settled.current = true;
      }
      setView(v);
      const at = me ?? v.center;
      const n = ++asked.current;
      void regionName(at.lat, at.lng).then((r) => {
        if (n === asked.current) setPlace(r ? regionLabel(r.gu, r.dong, v.north - v.south) : null);
      });
    },
    [me, focus],
  );

  const label = `내 지도 열기${place ? `, ${place}` : ""}, ${view ? "지도에" : "저장"} ${counts.saved}곳, 3숟가락 ${counts.three}곳, 가고 싶은 곳 ${counts.want}곳`;
  return (
    <div className="relative mx-5 flex flex-col overflow-hidden rounded-[16px] border border-line">
      <div ref={box} inert aria-hidden="true" className="relative isolate h-[132px] w-full bg-map-land">
        {seen && <PlaceMap pins={pins} selectedId={null} onSelect={noop} padding={PADDING} cluster focus={focus} refit="hidden" me={me} quiet onViewChange={onView} />}
        {place && (
          <span className="absolute top-2.5 left-2.5 z-10 flex h-7 items-center gap-1 rounded-full bg-white/95 px-2.5 text-meta font-semibold text-ink shadow-float">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={me ? "text-me" : "text-muted"}>
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            {place}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 divide-x divide-line py-2.5 text-meta text-ink-2">
        <span className="flex items-center justify-center gap-1">
          {view ? "지도에" : "저장"} <b className="text-ink">{counts.saved}</b>곳
        </span>
        <span className="flex items-center justify-center gap-1">
          <TierSpoons tier="three" height={11} />
          <b className="text-ink">{counts.three}</b>곳
        </span>
        <span className="flex items-center justify-center gap-1">
          <TierIcon tier="wantToGo" height={12} />
          <b className="text-ink">{counts.want}</b>곳
        </span>
      </div>
      {/* 지도 · 숫자 위를 덮는 링크 — 지도 안 핀 버튼과 겹치지 않게 형제로 */}
      <Link href="/map" aria-label={label} className="absolute inset-0" />
    </div>
  );
}
