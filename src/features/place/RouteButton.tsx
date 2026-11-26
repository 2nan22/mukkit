"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SourceMark } from "@/components/brand/BrandLogo";
import { MapAppLink } from "@/components/ui/MapAppLink";
import type { MapLink, RouteApp } from "@/domain/mapLinks";

// 길찾기 — 어느 지도 앱으로 갈지 고른다 (75). 마지막으로 고른 앱을 맨 위에(기기에 기억)
const APPS: { app: RouteApp; label: string }[] = [
  { app: "kakao", label: "카카오맵" },
  { app: "naver", label: "네이버 지도" },
  { app: "google", label: "구글 지도" },
];
const LAST_KEY = "mk_route_app";

function readLast(): RouteApp | null {
  try {
    const v = localStorage.getItem(LAST_KEY);
    return v === "kakao" || v === "naver" || v === "google" ? v : null;
  } catch {
    return null;
  }
}

export function RouteButton({ links, className, children }: { links: Record<RouteApp, MapLink>; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<RouteApp | null>(null);
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) sheet.current?.focus();
  }, [open]);
  const pick = (app: RouteApp) => {
    try {
      localStorage.setItem(LAST_KEY, app);
    } catch {}
    setOpen(false);
  };
  const ordered = last ? [...APPS].sort((a, b) => Number(b.app === last) - Number(a.app === last)) : APPS;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLast(readLast());
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={() => setOpen(false)}>
            <section
              ref={sheet}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="route-title"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              className="flex w-full max-w-[480px] flex-col gap-1 rounded-t-[20px] bg-white px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none"
            >
              <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
              <h2 id="route-title" className="pt-3 pb-1 text-section font-bold">
                어떤 앱으로 길찾기 할까요?
              </h2>
              {ordered.map(({ app, label }) => (
                <div key={app} onClickCapture={() => pick(app)}>
                  <MapAppLink link={links[app]} className="flex min-h-14 items-center gap-3 text-body font-semibold text-ink">
                    <SourceMark source={app} size={24} />
                    <span className="flex-1">{label}</span>
                    {app === last && <span className="text-meta font-normal text-muted">최근 사용</span>}
                  </MapAppLink>
                </div>
              ))}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
