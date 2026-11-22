import Link from "next/link";
import type { ReactNode } from "react";
import type { Cuisine } from "@/domain/cuisine";
import type { Tier } from "@/domain/tier";
import { CuisineIcon } from "./CuisineIcon";
import { TierBadge } from "./TierBadge";

type Props = {
  name: string;
  cuisine: Cuisine;
  meta: string;
  tier?: Tier | null;
  // 셋째 줄 — 추천 이유 등
  note?: ReactNode;
  // 왼쪽 순번 · 오른쪽 끝 버튼(편집 삭제 등)
  index?: number;
  action?: ReactNode;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  id?: string;
  // 대표 사진(사용자가 올린 평가 사진) — 없으면 업종 아이콘
  thumb?: string | null;
};

// 모든 장소 목록이 같은 모양 — 업종 아이콘 · 이름 · 메타 · 등급은 오른쪽 끝
export function PlaceRow({ name, cuisine, meta, tier, note, index, action, href, onClick, selected, id, thumb }: Props) {
  const body = (
    <>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
        <img src={thumb} alt="" loading="lazy" className="size-10 shrink-0 rounded-[12px] bg-surface object-cover" />
      ) : (
        <CuisineIcon cuisine={cuisine} size={40} />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body font-semibold">{name}</span>
        <span className="truncate text-meta text-muted">{meta}</span>
        {note && <span className="text-meta leading-normal text-ink-2">{note}</span>}
      </span>
      {tier && <TierBadge tier={tier} />}
    </>
  );
  const inner = "flex min-w-0 flex-1 items-center gap-3 text-left";
  return (
    <div id={id} className={`-mx-2 flex min-h-16 items-center gap-2.5 rounded-btn-m px-2 py-2.5 ${selected ? "bg-surface" : ""}`}>
      {index !== undefined && <span className="w-4 shrink-0 text-center text-meta text-subtle">{index}</span>}
      {href ? (
        <Link href={href} className={inner}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-pressed={selected} className={inner}>
          {body}
        </button>
      )}
      {action}
    </div>
  );
}
