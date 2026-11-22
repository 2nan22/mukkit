import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { CuisineIcon } from "@/components/ui/CuisineIcon";
import { ListThumb, topCuisines } from "@/components/ui/ListThumb";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { FollowButton } from "@/features/social/FollowButton";
import type { RecentList, SharedRating, TasteMatch } from "@/features/social/social";

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "어제" : `${days}일 전`;
}

function SectionHead({ title, sub, more }: { title: string; sub?: string; more?: string }) {
  return (
    <div className="flex items-center justify-between px-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-section font-bold">{title}</h2>
        {sub && <span className="text-meta text-muted">{sub}</span>}
      </div>
      {more && (
        <Link href={more} className="flex h-btn-m items-center text-meta text-muted">
          전체보기
        </Link>
      )}
    </div>
  );
}

// 팔로잉 새 평가 — 가로로 넘기는 카드
export function FollowingNew({ ratings, followingCount }: { ratings: SharedRating[]; followingCount: number }) {
  const anyPhoto = ratings.some((r) => r.media.some((m) => m.kind === "image"));
  return (
    <section className="flex flex-col gap-2">
      <SectionHead title="팔로잉 새 평가" more={ratings.length ? "/feed" : undefined} />
      {ratings.length === 0 ? (
        <div className="mx-5 flex items-center justify-between gap-3 rounded-[16px] bg-surface p-4">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-body font-semibold">{followingCount > 0 ? "팔로잉의 새 평가가 아직 없어요" : "아직 팔로우한 사람이 없어요"}</span>
            <span className="text-meta text-muted">{followingCount > 0 ? "새로 평가하면 여기에 보여요" : "취향이 비슷한 사람부터 찾아보세요"}</span>
          </span>
          <Link href="/people" className="flex h-9 shrink-0 items-center rounded-full bg-white px-3.5 text-meta font-semibold text-ink">
            사람 찾기
          </Link>
        </div>
      ) : (
        <ul className="flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {ratings.map((r) => (
            <li key={`${r.ownerId}:${r.placeId}`} className="flex shrink-0">
              <Link href={`/p/${r.placeId}`} className="flex w-[260px] flex-col overflow-hidden rounded-[16px] border border-line">
                {r.media.find((m) => m.kind === "image") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
                  <img src={r.media.find((m) => m.kind === "image")!.url} alt="" className="h-[120px] w-full object-cover" />
                ) : anyPhoto ? (
                  <span className={`flex h-[120px] items-center justify-center ${SOFT[r.tier] ?? "bg-surface"}`}>
                    <CuisineIcon cuisine={r.cuisine} />
                  </span>
                ) : null}
                <span className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <span className="flex items-center gap-1.5 text-meta text-muted">
                    <Avatar name={r.ownerNickname} size={24} />
                    <span className="truncate">
                      {r.ownerNickname} · {timeAgo(r.updatedAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[16px] font-semibold">{r.placeName}</span>
                    <TierBadge tier={r.tier} />
                  </span>
                  <span className="truncate text-meta text-muted">{[CUISINE_LABEL[r.cuisine], regionOf(r.address)].filter(Boolean).join(" · ")}</span>
                  {r.review && <span className="line-clamp-2 text-meta leading-normal text-ink-2">{r.review}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 취향이 비슷한 사람 — 줄마다 팔로우
export function SimilarPeople({ matches: all }: { matches: TasteMatch[] }) {
  // 같이 평가한 곳이 없으면 비슷하다고 할 근거가 없다
  const matches = all.filter((m) => m.overlap > 0);
  if (matches.length === 0) return null;
  return (
    <section className="flex flex-col">
      <SectionHead title="취향이 비슷한 사람" sub="나와 평가가 비슷한 순" more="/people" />
      <ul className="px-5">
        {matches.slice(0, 4).map((m) => (
          <li key={m.userId} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
            <Link href={`/u/${m.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={m.nickname} size={40} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-body font-bold">{m.nickname}</span>
                <span className="truncate text-meta text-muted">
                  {m.bothThree > 0 ? `둘 다 3스타 ${m.bothThree}곳` : `같이 평가한 곳 ${m.overlap}곳`} · 취향 일치 {Math.round(m.similarity * 100)}%
                </span>
              </span>
            </Link>
            <FollowButton targetId={m.userId} following={false} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

const SOFT: Record<string, string> = {
  three: "bg-tier-3-soft",
  two: "bg-tier-2-soft",
  one: "bg-tier-1-soft",
};


export function RecentLists({ lists, covers = {} }: { lists: RecentList[]; covers?: Record<string, string> }) {
  if (lists.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title="새로 올라온 리스트" />
      <div className="grid grid-cols-2 gap-2.5 px-5">
        {lists.slice(0, 4).map((l) => (
          <Link key={l.id} href={`/l/${l.id}`} className="flex min-w-0 flex-col gap-1.5">
            <ListThumb
              size="card"
              count={l.count}
              photos={l.points.flatMap((p) => (covers[p.placeId] ? [covers[p.placeId]] : [])).slice(0, 4)}
              cuisines={topCuisines(l.points)}
            />
            <span className="truncate text-body font-bold">{l.name}</span>
            <span className="truncate text-meta text-muted">{l.ownerNickname}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
