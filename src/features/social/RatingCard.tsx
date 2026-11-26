import Link from "next/link";
import { Memo } from "@/components/ui/Memo";
import { Avatar } from "@/components/ui/Avatar";
import { AteMenus } from "@/components/ui/AteMenus";
import { Companions } from "@/components/ui/Companions";
import { TierSpoons } from "@/components/ui/TierIcon";
import { FoodArt } from "@/components/ui/CuisineIcon";
import { TIER_LABEL, type Tier } from "@/domain/tier";
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
  const meta = [CUISINE_LABEL[rating.cuisine], regionOf(rating.address)];
  // 영상이 있으면 재생 막대와 겹쳐 사진 위 가게 이름을 얹지 않고 아래 가게 칸으로 (81)
  const onPhoto = rating.media.length > 0 && rating.media.every((m) => m.kind === "image");
  return (
    // 피드 B안 (81, 사용자 결정 2026-11-27) — 사람 줄 › 사진 위 가게 이름 · 숟가락 › 한 줄 평가 › 반응
    // 사람 이름과 가게 이름이 섞여 보이지 않게 사람은 머리 줄, 가게는 사진 위(사진 없으면 회색 가게 칸)
    <TapToPlace placeId={rating.placeId} className="-mx-5 flex flex-col gap-2.5 border-b border-line px-5 pt-3 pb-1">
      <div className="flex h-8 items-center gap-2">
        {showOwner && (
          <Link href={`/u/${rating.ownerId}`} className="flex min-w-0 items-center gap-2">
            <Avatar name={rating.ownerNickname} size={32} />
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{rating.ownerNickname}</span>
          </Link>
        )}
        <span className="shrink-0 text-meta text-muted">{dateLabel(rating.updatedAt)}</span>
        <span className="ml-auto">{menu}</span>
      </div>
      {onPhoto ? (
        <MediaStrip
          media={rating.media}
          overlay={
            // 그라데이션은 누르기 · 밀기를 사진에 넘기고, 가게 이름 · 등급만 링크 (81 검토)
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-4 pt-14 pb-3.5 text-white">
              <Link
                href={`/p/${rating.placeId}`}
                className="pointer-events-auto flex items-center justify-between gap-3 rounded-[8px] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[17px] font-bold tracking-[-0.02em]">{rating.placeName}</span>
                  <MetaLine className="text-caption font-medium text-white/90 [&>span[aria-hidden]]:bg-white/50" items={meta} />
                </span>
                <TierChip tier={rating.tier} raised />
              </Link>
            </div>
          }
        />
      ) : (
        <>
          {rating.media.length > 0 && <MediaStrip media={rating.media} />}
          {/* 회색 메모 칸과 겹쳐 보이지 않게 가게 칸은 흰 바탕 테두리 */}
          <Link href={`/p/${rating.placeId}`} className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface">
              <FoodArt cuisine={rating.cuisine} size={28} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-bold tracking-[-0.015em]">{rating.placeName}</span>
              <MetaLine items={meta} />
            </span>
            <TierChip tier={rating.tier} />
          </Link>
        </>
      )}
      {rating.review && <p className="text-body leading-normal text-ink">{rating.review}</p>}
      {(rating.note || rating.alias) && <Memo text={rating.note} alias={rating.alias} source={rating.noteSource} />}
      <AteMenus menus={rating.menus} />
      <Companions people={rating.companions} />
      {reaction && <ReactionBar ownerId={rating.ownerId} placeId={rating.placeId} reaction={reaction} mine={viewerId === rating.ownerId} showComments={showComments} />}
    </TapToPlace>
  );
}

// 등급은 글자 대신 숟가락 개수 — 흰 알약 안 (사진 위에서도 보이게) · 낭독기엔 등급 이름
// raised: 사진 위에서만 그림자 — 흰 가게 칸에서는 테두리만(떠 있는 버튼처럼 보이지 않게)
function TierChip({ tier, raised = false }: { tier: Tier; raised?: boolean }) {
  return (
    <span className={`flex h-7 shrink-0 items-center rounded-full bg-white px-2.5 ${raised ? "shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "border border-line"}`}>
      <TierSpoons tier={tier} height={14} fit />
      <span className="sr-only">{TIER_LABEL[tier]}</span>
    </span>
  );
}
