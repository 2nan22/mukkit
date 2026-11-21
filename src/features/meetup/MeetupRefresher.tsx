"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 상대를 기다리는 동안 — 화면에 돌아오거나 15초마다 새로 읽는다
export function MeetupRefresher({ waiting }: { waiting: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!waiting) return;
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const timer = setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [waiting, router]);
  return null;
}
