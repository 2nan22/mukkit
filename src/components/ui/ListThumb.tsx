import type { Cuisine } from "@/domain/cuisine";
import { CUISINE_ICON_PATH } from "./CuisineIcon";

function Icon({ cuisine, size }: { cuisine: Cuisine; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CUISINE_ICON_PATH[cuisine]} />
    </svg>
  );
}

// 리스트 카드 64px 썸네일
// 사진 4장 이상: 2×2 사진 · 일부만: 사진 먼저, 남는 칸은 많이 담긴 업종 아이콘 · 사진 없음: 업종 아이콘 두 개 겹치기
export function ListThumb({ photos, cuisines }: { photos: string[]; cuisines: Cuisine[] }) {
  const top = cuisines.length ? cuisines : (["other"] as Cuisine[]);
  if (photos.length === 0) {
    return (
      <span aria-hidden="true" className="relative block size-16 shrink-0">
        <span className="absolute top-1 left-0 flex size-10 items-center justify-center rounded-[12px] bg-surface text-ink-2">
          <Icon cuisine={top[0]} size={20} />
        </span>
        {top[1] && (
          <span className="absolute top-5 left-6 flex size-10 items-center justify-center rounded-[12px] border border-line bg-white text-ink-2">
            <Icon cuisine={top[1]} size={20} />
          </span>
        )}
      </span>
    );
  }
  const fill = Array.from({ length: Math.max(0, 4 - photos.length) }, (_, i) => top[i % top.length]);
  return (
    <span aria-hidden="true" className="grid size-16 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-[10px]">
      {photos.slice(0, 4).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
        <img key={i} src={src} alt="" loading="lazy" className="size-full bg-surface object-cover" />
      ))}
      {fill.map((c, i) => (
        <span key={`c${i}`} className="flex items-center justify-center bg-surface text-subtle">
          <Icon cuisine={c} size={14} />
        </span>
      ))}
    </span>
  );
}
