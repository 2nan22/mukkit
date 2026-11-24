import type { Purpose } from "@/domain/meetup";

// 약속 목적 아이콘 — 선 그림 (이모지 대신)
const PATHS: Record<Purpose, string> = {
  meal: "M4 12h16a8 8 0 0 1-16 0zM9 8c0-1.5 1-2 1-3.5M14 8c0-1.5 1-2 1-3.5",
  team: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5M11 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5",
  date: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  drinks: "M7 3h10l-1 7a4 4 0 0 1-8 0zM12 14v6M8 21h8",
  cafe: "M4 9h12v5a5 5 0 0 1-10 0zM16 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3",
};

export function PurposeIcon({ purpose, size = 22 }: { purpose: Purpose; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[purpose]} />
    </svg>
  );
}
