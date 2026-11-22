import type { Cuisine } from "@/domain/cuisine";
import { CUISINE_ICON_PATH } from "./CuisineIcon";

function Icon({ cuisine, size }: { cuisine: Cuisine; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CUISINE_ICON_PATH[cuisine]} />
    </svg>
  );
}

// 많이 담긴 업종 순서 — 썸네일 아이콘 자리
export function topCuisines(items: { cuisine: Cuisine }[]): Cuisine[] {
  const count = new Map<Cuisine, number>();
  for (const i of items) count.set(i.cuisine, (count.get(i.cuisine) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

// 리스트 썸네일 — thumb: 목록 줄 64px · card: 홈 카드(가로 꽉 참 · 개수 표시)
// 사진 4장 이상: 2×2 사진 · 일부만: 사진 먼저, 남는 칸은 많이 담긴 업종 아이콘 · 사진 없음: 업종 아이콘 두 개 겹치기
export function ListThumb({ photos, cuisines, size = "thumb", count }: { photos: string[]; cuisines: Cuisine[]; size?: "thumb" | "card"; count?: number }) {
  const top = cuisines.length ? cuisines : (["other"] as Cuisine[]);
  const card = size === "card";
  const box = card ? "relative h-28 w-full rounded-[14px]" : "relative size-16 shrink-0 rounded-[10px]";
  const badge = card && count !== undefined && (
    <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-caption font-semibold text-ink">{count}곳</span>
  );
  if (photos.length === 0) {
    const tile = card ? "size-12 rounded-[14px]" : "size-10 rounded-[12px]";
    const icon = card ? 24 : 20;
    return (
      <span aria-hidden="true" className={`block overflow-hidden ${box} ${card ? "bg-surface" : ""}`}>
        <span className={`absolute flex items-center justify-center bg-surface text-ink-2 ${tile} ${card ? "top-[calc(50%-34px)] left-[calc(50%-38px)] bg-white" : "top-1 left-0"}`}>
          <Icon cuisine={top[0]} size={icon} />
        </span>
        {top[1] && (
          <span className={`absolute flex items-center justify-center border border-line bg-white text-ink-2 ${tile} ${card ? "top-[calc(50%-10px)] left-[calc(50%-10px)]" : "top-5 left-6"}`}>
            <Icon cuisine={top[1]} size={icon} />
          </span>
        )}
        {badge}
      </span>
    );
  }
  const fill = Array.from({ length: Math.max(0, 4 - photos.length) }, (_, i) => top[i % top.length]);
  return (
    <span aria-hidden="true" className={`grid grid-cols-2 gap-0.5 overflow-hidden ${box}`}>
      {photos.slice(0, 4).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
        <img key={i} src={src} alt="" loading="lazy" className="size-full min-h-0 bg-surface object-cover" />
      ))}
      {fill.map((c, i) => (
        <span key={`c${i}`} className="flex min-h-0 items-center justify-center bg-surface text-subtle">
          <Icon cuisine={c} size={card ? 18 : 14} />
        </span>
      ))}
      {badge}
    </span>
  );
}
