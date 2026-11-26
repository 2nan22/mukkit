"use client";

import type { MouseEvent, ReactNode } from "react";
import { platformOf, type MapLink } from "@/domain/mapLinks";

// 외부 지도 링크 (72) — 폰은 지도 앱으로, 앱이 없거나 컴퓨터면 웹 새 탭
// 안드로이드 intent 는 앱이 없으면 브라우저가 알아서 웹으로. 아이폰은 앱 주소를 연 뒤 화면이 그대로면(앱이 안 열림) 웹으로
export function MapAppLink({ link, className, children }: { link: MapLink; className?: string; children: ReactNode }) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    const platform = platformOf(navigator.userAgent);
    const appUrl = platform === "android" ? link.android : platform === "ios" ? link.ios : undefined;
    if (!appUrl) return;
    e.preventDefault();
    if (platform === "ios") {
      // 사파리는 '앱에서 열까요?'를 먼저 묻는다 — 답할 시간을 두고, 앱이 열려 화면이 가려지면 웹으로 넘기지 않는다
      const timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") window.location.href = link.web;
      }, 2500);
      const stop = () => window.clearTimeout(timer);
      document.addEventListener("visibilitychange", stop, { once: true });
      window.addEventListener("pagehide", stop, { once: true });
      window.addEventListener("blur", stop, { once: true });
    }
    window.location.href = appUrl;
  }
  return (
    <a href={link.web} target="_blank" rel="noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
