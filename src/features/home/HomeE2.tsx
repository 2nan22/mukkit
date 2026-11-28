import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { FoodArt } from "@/components/ui/CuisineIcon";
import { MetaLine } from "@/components/ui/MetaLine";
import { TierSpoons } from "@/components/ui/TierIcon";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { TIER_LABEL, type Tier } from "@/domain/tier";
import type { SharedRating, TasteMatch } from "@/features/social/social";
import type { ActionTile } from "./homeMeetup";

// 홈 E2 (96, 사용자 결정 2026-11-28) — 얼굴 줄 › 큰 평가 한 장 › 두 칸(뭐 먹지 · 약속) › 기다리는 일 › 새 평가 더 › 내 기록
// 시안 https://claude.ai/artifact/G8rofSmYL2nPhroX1Nb99T

const FRESH_MS = 72 * 3600_000;

// 팔로잉 얼굴 줄 — 최근에 평가한 사람 순 · 사흘 안 평가면 검정 테두리, 지난 것은 회색
export function PeopleRow({ ratings, now }: { ratings: SharedRating[]; now: number }) {
  const seen = new Set<string>();
  const people = ratings.filter((r) => (seen.has(r.ownerId) ? false : (seen.add(r.ownerId), true))).slice(0, 12);
  if (people.length === 0) return null;
  return (
    <ul aria-label="팔로잉 새 평가" className="relative flex gap-3 overflow-x-auto px-5 pt-1 pb-1 [scrollbar-width:none]">
      {people.map((r) => {
        const fresh = now - new Date(r.ratedAt).getTime() < FRESH_MS;
        return (
          <li key={r.ownerId} className="shrink-0">
            <Link href={`/u/${r.ownerId}`} className="flex w-16 flex-col items-center gap-1">
              <span className={`relative rounded-full border-2 p-[2px] ${fresh ? "border-ink" : "border-line-strong"}`}>
                <Avatar name={r.ownerNickname} size={56} />
                <span className="absolute -right-1 -bottom-1 flex h-5 items-center rounded-full border border-line bg-white px-1">
                  <TierSpoons tier={r.tier} height={10} fit />
                  <span className="sr-only">{TIER_LABEL[r.tier]}</span>
                </span>
              </span>
              <span className={`w-full truncate text-center text-caption ${fresh ? "font-semibold text-ink" : "text-muted"}`}>{r.ownerNickname}</span>
            </Link>
          </li>
        );
      })}
      <FindPeople />
    </ul>
  );
}

// 팔로잉이 없을 때 — 같은 자리를 취향이 비슷한 사람으로
export function MatchRow({ matches }: { matches: TasteMatch[] }) {
  const list = matches.filter((m) => m.overlap > 0).slice(0, 10);
  return (
    <section className="flex flex-col gap-2">
      <span className="px-5 text-meta text-muted">취향이 비슷한 사람을 팔로우하면 새 평가가 여기 모여요</span>
      <ul className="relative flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {list.map((m) => (
          <li key={m.userId} className="shrink-0">
            <Link href={`/u/${m.userId}`} className="flex w-16 flex-col items-center gap-1">
              <span className="rounded-full border-2 border-line-strong p-[2px]">
                <Avatar name={m.nickname} size={56} />
              </span>
              <span className="w-full truncate text-center text-caption font-semibold">{m.nickname}</span>
              <span className="text-caption text-muted">일치 {Math.round(m.similarity * 100)}%</span>
            </Link>
          </li>
        ))}
        <FindPeople />
      </ul>
    </section>
  );
}

// 큰 평가 한 장 — 사진이 있으면 사진 위 이름, 없으면 업종 그림 칸(낮게)
// compact: '새 평가 더'의 사진 없는 평가는 낮은 줄로 — 큰 칸이 이어져 단조롭지 않게 (96 디자인 검토)
export function RatingTile({ rating, date, compact = false }: { rating: SharedRating; date: string; compact?: boolean }) {
  const photo = rating.media.find((m) => m.kind === "image");
  const meta = [CUISINE_LABEL[rating.cuisine], regionOf(rating.address)];
  if (compact && !photo) {
    return (
      <article className="flex flex-col px-5">
        <div className="flex h-10 items-center gap-2">
          <Link href={`/u/${rating.ownerId}`} className="flex min-w-0 items-center gap-2">
            <Avatar name={rating.ownerNickname} size={24} />
            <span className="truncate text-[15px] font-bold tracking-[-0.015em]">{rating.ownerNickname}</span>
          </Link>
          <span className="ml-auto shrink-0 text-meta text-subtle">{date}</span>
        </div>
        <Link href={`/p/${rating.placeId}`} className="flex h-[88px] items-center gap-3 rounded-[16px] bg-map-land px-4">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-white">
            <FoodArt cuisine={rating.cuisine} size={36} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[17px] font-bold tracking-[-0.02em]">{rating.placeName}</span>
            <MetaLine items={meta} />
          </span>
          <TierPill tier={rating.tier} raised={false} />
        </Link>
      </article>
    );
  }
  return (
    <article className="flex flex-col px-5">
      <div className="flex h-10 items-center gap-2">
        <Link href={`/u/${rating.ownerId}`} className="flex min-w-0 items-center gap-2">
          <Avatar name={rating.ownerNickname} size={24} />
          <span className="truncate text-[15px] font-bold tracking-[-0.015em]">{rating.ownerNickname}</span>
        </Link>
        <span className="ml-auto shrink-0 text-meta text-subtle">{date}</span>
      </div>
      <Link
        href={`/p/${rating.placeId}`}
        className={`relative flex overflow-hidden rounded-[16px] ${photo ? "h-[216px]" : "h-[120px] bg-map-land"}`}
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다 */}
            <img src={photo.url} alt="" className="absolute inset-0 size-full object-cover" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent from-45% to-black/65" />
          </>
        ) : (
          <span aria-hidden="true" className="absolute top-3 right-4">
            <FoodArt cuisine={rating.cuisine} size={48} />
          </span>
        )}
        <span className={`relative mt-auto flex w-full items-end justify-between gap-3 p-4 ${photo ? "text-white" : "text-ink"}`}>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[20px] leading-7 font-bold tracking-[-0.02em]">{rating.placeName}</span>
            <MetaLine className={photo ? "text-meta text-white/90 [&>span[aria-hidden]]:bg-white/50" : undefined} items={meta} />
          </span>
          <TierPill tier={rating.tier} raised={Boolean(photo)} />
        </span>
      </Link>
    </article>
  );
}

function TierPill({ tier, raised }: { tier: Tier; raised: boolean }) {
  return (
    <span className={`flex h-7 shrink-0 items-center rounded-full bg-white px-2 ${raised ? "shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "border border-line"}`}>
      <TierSpoons tier={tier} height={14} fit />
      <span className="sr-only">{TIER_LABEL[tier]}</span>
    </span>
  );
}

const ICON: Record<ActionTile["icon"], React.ReactNode> = {
  eat: <path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 21V3c-2 1-3.5 3.5-3.5 7 0 2 1.5 3 3.5 3" />,
  people: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M3 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5M11 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
};

// 두 칸 — 주황은 하나뿐 (homeTiles 가 정함)
export function ActionTiles({ tiles }: { tiles: [ActionTile, ActionTile] }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-5">
      {tiles.map((t) => (
        <Link
          key={t.icon}
          href={t.href}
          className={`flex h-16 min-w-0 flex-col justify-center rounded-[12px] px-3 ${t.primary ? "bg-brand text-white raised-brand" : "border border-line-strong text-ink"}`}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-[15px] leading-5 font-bold tracking-[-0.015em]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
              {ICON[t.icon]}
            </svg>
            <span className="truncate">{t.title}</span>
          </span>
          <span className={`truncate text-caption ${t.primary ? "text-white" : "text-muted"}`}>{t.sub}</span>
        </Link>
      ))}
    </div>
  );
}

// 기다리는 일 한 줄 — 있는 것만
export function WaitLine({ visitTags, unrated }: { visitTags: number; unrated: number }) {
  if (!visitTags && !unrated) return null;
  return (
    <div className="mx-5 flex h-12 items-center border-y border-line text-meta text-muted">
      {visitTags > 0 && (
        <Link href="/visits" className="flex h-full items-center gap-1">
          함께 방문 요청 <b className="font-bold text-ink">{visitTags}</b>
        </Link>
      )}
      {visitTags > 0 && unrated > 0 && <span aria-hidden="true" className="mx-3 h-2.5 w-px bg-line-strong" />}
      {unrated > 0 && (
        <Link href="/rate" className="flex h-full items-center gap-1">
          평가 전 <b className="font-bold text-ink">{unrated}곳</b>
        </Link>
      )}
    </div>
  );
}

// 얼굴 줄 끝 — 사람 찾기 (점선 동그라미)
function FindPeople() {
  return (
    <li className="shrink-0">
      <Link href="/people" className="flex w-16 flex-col items-center gap-1">
        <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-muted">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </span>
        <span className="text-caption font-semibold">사람 찾기</span>
      </Link>
    </li>
  );
}
