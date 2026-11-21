"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { distanceMeters } from "@/domain/samePlace";

const RADIUS_METERS = 1000;
type State = { kind: "idle" } | { kind: "locating" } | { kind: "found"; count: number; at: string } | { kind: "denied" };

// 위치는 이미 허락한 경우에만 바로 쓰고, 아니면 누를 때 묻는다
export function NearbyWantToGo({ points }: { points: { lat: number; lng: number }[] }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  function locate() {
    if (!navigator.geolocation) return setState({ kind: "denied" });
    setState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { name: "", lat: coords.latitude, lng: coords.longitude };
        const count = points.filter((p) => distanceMeters(here, { name: "", ...p }) <= RADIUS_METERS).length;
        setState({ kind: "found", count, at: `${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}` });
      },
      () => setState({ kind: "denied" }),
      { maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  }

  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (p.state === "granted") locate();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만 확인
  }, []);

  if (points.length === 0) return null;

  const title =
    state.kind === "found"
      ? state.count > 0
        ? `가고 싶은 곳 ${state.count}곳이 근처에 있어요`
        : "근처 1km 안에는 가고 싶은 곳이 없어요"
      : state.kind === "locating"
        ? "지금 위치를 찾는 중이에요"
        : state.kind === "denied"
          ? "위치를 쓸 수 없어요"
          : "근처 가고 싶은 곳 보기";
  const sub =
    state.kind === "found"
      ? "지금 위치에서 1km 안"
      : state.kind === "denied"
        ? "브라우저 설정에서 위치 권한을 허용해 주세요"
        : `가고 싶은 곳 ${points.length}곳 중에서 찾아요`;

  const body = (
    <>
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-body font-semibold">{title}</span>
        <span className="text-meta text-muted">{sub}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </>
  );
  const cls = "flex items-center gap-3 border-t border-[#f5dccb] px-5 py-3.5";

  return state.kind === "found" && state.count > 0 ? (
    <Link href={`/map?tier=wantToGo&at=${state.at}`} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={locate} disabled={state.kind === "locating"} className={cls}>
      {body}
    </button>
  );
}
