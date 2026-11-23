"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { densestFocus, nearMeFocus, type MapFocus } from "@/domain/mapFocus";
import { PlaceMap, type MyLocation, type Pin } from "@/features/map/PlaceMap";
import type { HomePoint } from "./myHome";

const PADDING = [24, 24, 24, 24] as const;
const noop = () => {};

// 홈 내 지도 — 실제 카카오맵 미리보기. 화면에 들어올 때만 지도를 띄우고(SDK · 쿼터 아끼기),
// inert 로 만지거나 포커스가 들어가지 않게 — 누르면 위를 덮은 링크가 지도 탭으로
// 처음 보이는 곳: 위치 권한을 이미 줬고 둘레 3km 에 내 장소가 있으면 지금 위치, 아니면 장소가 가장 많이 모인 동네 (50)
export function HomeMiniMap({ points }: { points: HomePoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [me, setMe] = useState<MyLocation | null>(null);
  const pins: Pin[] = useMemo(() => points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, tier: p.tier })), [points]);

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

  return (
    <div ref={box} inert aria-hidden="true" className="relative isolate h-[132px] w-full bg-map-land">
      {seen && <PlaceMap pins={pins} selectedId={null} onSelect={noop} padding={PADDING} cluster focus={focus} me={me} />}
    </div>
  );
}
