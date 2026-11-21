"use client";

import { useLeave } from "@/lib/nav/useLeave";

export function BackButton({ fallback, kind = "back", className = "" }: { fallback: string; kind?: "back" | "close"; className?: string }) {
  const leave = useLeave(fallback);
  return (
    <button type="button" onClick={leave} aria-label={kind === "back" ? "뒤로" : "닫기"} className={`flex size-11 shrink-0 items-center justify-center ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === "back" ? <path d="M15 5l-7 7 7 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
      </svg>
    </button>
  );
}
