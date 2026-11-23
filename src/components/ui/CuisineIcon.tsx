import type { Cuisine } from "@/domain/cuisine";
import { foodArtSrc } from "@/domain/foodKind";

// 사진이 없는 장소의 썸네일 — 세부 업종(없으면 업종) 기본 그림 (51)
export function FoodArt({ cuisine, kind, size }: { cuisine: Cuisine; kind?: string | null; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- 작은 정적 그림이라 next/image 최적화가 필요 없다
  return <img src={foodArtSrc(kind, cuisine)} alt="" width={size} height={size} loading="lazy" aria-hidden="true" className="shrink-0 select-none" />;
}

export function CuisineIcon({ cuisine, kind, size = 48 }: { cuisine: Cuisine; kind?: string | null; size?: 40 | 48 }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-[12px] bg-surface ${size === 48 ? "size-12" : "size-10"}`}>
      <FoodArt cuisine={cuisine} kind={kind} size={size === 48 ? 34 : 28} />
    </span>
  );
}
