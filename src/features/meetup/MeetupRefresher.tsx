"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 상대를 기다리는 동안 — 화면에 돌아오거나 15초마다 새로 읽는다 (만날 곳 근처 가게를 그리는 중이면 every 로 더 드물게, 91)
export function MeetupRefresher({ waiting, every = 15_000 }: { waiting: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!waiting) return;
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const timer = setInterval(refresh, every);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [waiting, every, router]);
  return null;
}
