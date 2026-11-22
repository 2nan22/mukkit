import type { Cuisine } from "@/domain/cuisine";

// 사진이 없는 장소 줄의 썸네일 자리 — 업종별 선 아이콘
export const CUISINE_ICON_PATH: Record<Cuisine, string> = {
  korean: "M4 11h16a8 8 0 0 1-16 0zM8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5",
  chinese: "M4 12h16a8 8 0 0 1-16 0zM14 3l-4 9M19 4l-6 8",
  japanese: "M4 14c0-2.5 3.6-4.5 8-4.5s8 2 8 4.5-3.6 4.5-8 4.5-8-2-8-4.5zM8 12.5c1.5-1.5 6.5-1.5 8 0",
  western: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2.5-3 6h3v12",
  asian: "M4 11h16a8 8 0 0 1-16 0zM9 3c-1 2 1 3 0 5M15 3c-1 2 1 3 0 5",
  snack: "M8 20L18 6M10 8.5a2 2 0 1 0 2.8 2.8M13 4.8a2 2 0 1 0 2.8 2.8",
  chicken: "M14.5 3.5a5 5 0 0 1 3 8.6l-5 1.4-1.4 1.4a2 2 0 1 1-3.6 2.6 2 2 0 1 1 2.6-3.6l1.4-1.4 1.4-5a5 5 0 0 1 1.6-4z",
  bar: "M6 3h12l-6 9-6-9zM12 12v8M8 21h8",
  cafe: "M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M9 3v2M13 3v2",
  other: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7.5v4M12 13.5v.1",
  nonFood: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z",
};

export function CuisineIcon({ cuisine, size = 48 }: { cuisine: Cuisine; size?: 40 | 48 }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-[12px] bg-surface text-ink-2 ${size === 48 ? "size-12" : "size-10"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={CUISINE_ICON_PATH[cuisine]} />
      </svg>
    </span>
  );
}
