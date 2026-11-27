"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

// 연말 결산 들어가는 줄 (70 · 94) — 12 · 1월, 그해 평가한 곳이 있을 때만 부르는 쪽에서 띄운다
// 홈 줄은 닫을 수 있다 — 닫은 해는 기기에 기억 (내 기록 통계 줄은 늘 보임)
const key = (year: number) => `recap-hide-${year}`;
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
function isHidden(year: number): boolean {
  try {
    return localStorage.getItem(key(year)) === "1";
  } catch {
    return false;
  }
}

export function RecapBanner({ year, closable = false, className = "" }: { year: number; closable?: boolean; className?: string }) {
  const hidden = useSyncExternalStore(
    subscribe,
    () => closable && isHidden(year),
    () => false,
  );
  if (hidden) return null;
  return (
    <div className={`relative flex min-h-14 items-center rounded-[16px] bg-[#17181c] text-white ${className}`}>
      <Link href="/my/recap" className={`flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-4 ${closable ? "pr-1" : "pr-4"}`}>
        <span className="flex min-w-0 flex-col">
          <span className="text-body font-bold">{year} 먹킷 결산</span>
          <span className="text-meta text-white/70">올해 다닌 곳을 카드로 돌아봐요</span>
        </span>
        <span className="shrink-0 text-meta font-bold">보기</span>
      </Link>
      {closable && (
        <button
          type="button"
          aria-label="결산 줄 닫기"
          onClick={() => {
            try {
              localStorage.setItem(key(year), "1");
            } catch {
              // 저장소를 못 쓰면 이번 화면에서만 닫히지 않는다
            }
            listeners.forEach((f) => f());
          }}
          className="flex size-11 shrink-0 items-center justify-center text-white/70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

// 지난 결산 다시 보기 — 결산 철이 지나면 내 기록 통계 아래 한 줄
export function PastRecapLink({ year }: { year: number }) {
  return (
    <Link href={`/my/recap?year=${year}`} className="flex min-h-12 items-center justify-between rounded-[14px] border border-line px-4 text-body font-semibold text-ink">
      {year} 결산 다시 보기
      <span className="text-meta text-muted">보기</span>
    </Link>
  );
}
