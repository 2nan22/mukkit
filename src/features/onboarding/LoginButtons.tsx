"use client";

import { useSyncExternalStore } from "react";
import { GoogleG, KakaoSymbol, NaverN } from "@/components/brand/BrandLogo";
import { LAST_LOGIN_COOKIE, type LoginProvider } from "@/features/auth/providers";

const BUTTONS: { provider: LoginProvider; label: string; className: string; icon: React.ReactNode }[] = [
  { provider: "kakao", label: "카카오로 시작하기", className: "gap-2 bg-[#FEE500] text-black/85 raised", icon: <KakaoSymbol /> },
  { provider: "google", label: "Google로 시작하기", className: "gap-2.5 border border-[#747775] bg-white text-[#1F1F1F] raised-soft", icon: <GoogleG /> },
  { provider: "naver", label: "네이버로 시작하기", className: "gap-2.5 bg-[#03C75A] text-white raised", icon: <NaverN /> },
];

function readLastLogin(): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${LAST_LOGIN_COOKIE}=`));
  return hit ? decodeURIComponent(hit.split("=")[1]) : null;
}

// 쿠키는 바뀌어도 알림이 없다 — 처음 그릴 때 한 번만 읽는다
const noSubscribe = () => () => undefined;

export function LoginButtons({ next }: { next?: string } = {}) {
  const last = useSyncExternalStore(noSubscribe, readLastLogin, () => null);
  return (
    <>
      {BUTTONS.map((b) => (
        // 로그인 라우트는 a 로 전체 이동 — Link 프리페치가 OAuth 시작을 부르지 않게
        <a key={b.provider} href={`/auth/login/${b.provider}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={`relative flex h-btn-l items-center justify-center rounded-btn-l text-[16px] font-bold ${b.className}`}>
          {b.icon}
          {b.label}
          {last === b.provider && (
            <span className="absolute -top-2.5 right-3 flex h-5 items-center rounded-full bg-ink px-2 text-[11px] font-semibold text-white shadow-float">최근 로그인</span>
          )}
        </a>
      ))}
    </>
  );
}
