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
import { TapToPlace } from "./TapToPlace";
import { MediaStrip } from "./MediaStrip";

// 올해가 아니면 연도까지 — 가져온 평가는 지도에 저장한 날이라 몇 해 전일 수 있다 (68-9)
export function dateLabel(iso: string, now = new Date()): string {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso)).split("-").map(Number);
  const thisYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }).format(now));
  return y === thisYear ? `${m}월 ${d}일` : `${y}년 ${m}월 ${d}일`;
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
    <TapToPlace placeId={rating.placeId} className="-mx-5 flex flex-col gap-2.5 border-b border-line px-5 pt-4 pb-1">
      {showOwner && (
        // 머리줄 높이 32 — 사진과 10px 띄우고(전엔 -my-2 로 거의 붙음), 아바타 32 · 이름 14 (80 디자인 검토, 인스타그램)
        <div className="flex h-8 items-center justify-between">
          <Link href={`/u/${rating.ownerId}`} className="flex items-center gap-2">
            <Avatar name={rating.ownerNickname} size={32} />
            <span className="text-[14px] font-semibold tracking-[-0.01em]">{rating.ownerNickname}</span>
          </Link>
          {menu}
        </div>
      )}
      {rating.media.length > 0 && <MediaStrip media={rating.media} />}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/p/${rating.placeId}`} className="truncate text-body font-bold tracking-[-0.01em]">
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
      {(rating.note || rating.alias) && <Memo text={rating.note} alias={rating.alias} source={rating.noteSource} />}
      <AteMenus menus={rating.menus} />
      <Companions people={rating.companions} />
      {reaction && <ReactionBar ownerId={rating.ownerId} placeId={rating.placeId} reaction={reaction} mine={viewerId === rating.ownerId} showComments={showComments} />}
    </TapToPlace>
  );
}
