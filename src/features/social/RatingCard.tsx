import Link from "next/link";
import { Memo } from "@/components/ui/Memo";
import { Avatar } from "@/components/ui/Avatar";
import { AteMenus } from "@/components/ui/AteMenus";
import { Companions } from "@/components/ui/Companions";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { ReactionBar } from "@/features/reactions/ReactionBar";
import type { Reaction } from "@/features/reactions/reactions";
import { SafetyMenu } from "@/features/safety/SafetyMenu";
import type { SharedRating } from "./social";
import { MetaLine } from "@/components/ui/MetaLine";

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 피드 · 프로필 공용 — 공개 한마디 · 사진 · 등급만 (메모는 이 데이터에 없다)
// viewerId: 보는 사람 — 남의 평가에만 신고 · 차단 메뉴
// reaction: 좋아요 · 댓글 수 (없으면 줄을 그리지 않음) · showComments=false 는 댓글 화면 안
export function RatingCard({
  rating,
  showOwner,
  viewerId = null,
  reaction = null,
  showComments = true,
}: {
  rating: SharedRating;
  showOwner: boolean;
  viewerId?: string | null;
  reaction?: Reaction | null;
  showComments?: boolean;
}) {
  const menu = viewerId && viewerId !== rating.ownerId ? <SafetyMenu userId={rating.ownerId} nickname={rating.ownerNickname} placeId={rating.placeId} /> : null;
  return (
    <article className="flex flex-col gap-2.5 border-b border-line pt-4 pb-2">
      {showOwner && (
        <div className="-my-2 flex items-center justify-between">
          <Link href={`/u/${rating.ownerId}`} className="flex items-center gap-2">
            <Avatar name={rating.ownerNickname} size={24} />
            <span className="text-meta font-bold">{rating.ownerNickname}</span>
          </Link>
          {menu}
        </div>
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
          <MetaLine items={[CUISINE_LABEL[rating.cuisine], regionOf(rating.address), dateLabel(rating.updatedAt)]} />
        </div>
        <span className="flex items-center gap-1">
          <TierBadge tier={rating.tier} />
          {!showOwner && menu}
        </span>
      </div>
      {rating.review && <p className="text-body leading-normal text-ink-2">{rating.review}</p>}
      {rating.note && <Memo text={rating.note} source={rating.noteSource} />}
      <AteMenus menus={rating.menus} />
      <Companions people={rating.companions} />
      {reaction && <ReactionBar ownerId={rating.ownerId} placeId={rating.placeId} reaction={reaction} mine={viewerId === rating.ownerId} showComments={showComments} />}
    </article>
  );
}
