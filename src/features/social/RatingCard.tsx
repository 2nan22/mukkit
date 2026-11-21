import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Companions } from "@/components/ui/Companions";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import type { SharedRating } from "./social";

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 피드 · 프로필 공용 — 공개 한마디 · 사진 · 등급만 (메모는 이 데이터에 없다)
export function RatingCard({ rating, showOwner }: { rating: SharedRating; showOwner: boolean }) {
  return (
    <article className="flex flex-col gap-2.5 border-b border-line py-4">
      {showOwner && (
        <Link href={`/u/${rating.ownerId}`} className="flex items-center gap-2 self-start">
          <Avatar name={rating.ownerNickname} size={24} />
          <span className="text-meta font-bold">{rating.ownerNickname}</span>
        </Link>
      )}
      {rating.media.length > 0 && (
        <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-1.5 overflow-x-auto px-5">
          {rating.media.map((m, i) =>
            m.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
              <img key={i} src={m.url} alt="" className="aspect-[4/5] w-[78%] shrink-0 snap-start rounded-btn-l object-cover" />
            ) : (
              <video key={i} src={m.url} controls playsInline preload="metadata" className="aspect-[4/5] w-[78%] shrink-0 snap-start rounded-btn-l bg-black object-cover" />
            ),
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/p/${rating.placeId}`} className="truncate text-body font-bold">
            {rating.placeName}
          </Link>
          <span className="truncate text-meta text-muted">
            {[CUISINE_LABEL[rating.cuisine], regionOf(rating.address), dateLabel(rating.updatedAt)].filter(Boolean).join(" · ")}
          </span>
        </div>
        <TierBadge tier={rating.tier} />
      </div>
      {rating.review && <p className="text-body leading-normal text-ink-2">{rating.review}</p>}
      <Companions people={rating.companions} />
    </article>
  );
}
