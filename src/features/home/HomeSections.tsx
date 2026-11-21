import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { tierFromDb } from "@/domain/tier";
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
export function FollowingNew({ ratings }: { ratings: SharedRating[] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionHead title="팔로잉 새 평가" more={ratings.length ? "/feed" : undefined} />
      {ratings.length === 0 ? (
        <div className="mx-5 flex flex-col gap-1 rounded-btn-l border border-line p-4">
          <span className="text-body font-bold">아직 팔로우한 사람이 없어요</span>
          <span className="text-meta text-muted">취향이 비슷한 사람을 팔로우해 보세요</span>
        </div>
      ) : (
        <ul className="flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {ratings.map((r) => (
            <li key={`${r.ownerId}:${r.placeId}`} className="shrink-0">
              <Link href={`/p/${r.placeId}`} className="flex w-[220px] flex-col gap-1.5 rounded-btn-l border border-line p-3.5">
                <span className="flex items-center gap-1.5 text-meta text-muted">
                  <Avatar name={r.ownerNickname} size={24} />
                  <span className="truncate">
                    {r.ownerNickname} · {timeAgo(r.updatedAt)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-body font-bold">{r.placeName}</span>
                  <TierBadge tier={r.tier} />
                </span>
                <span className="truncate text-meta text-muted">{[CUISINE_LABEL[r.cuisine], regionOf(r.address)].filter(Boolean).join(" · ")}</span>
                {r.review && <span className="line-clamp-2 text-meta leading-normal text-ink-2">{r.review}</span>}
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
          <li key={m.userId} className="flex items-center gap-3 border-b border-line py-2.5">
            <Link href={`/u/${m.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={m.nickname} size={40} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-body font-bold">{m.nickname}</span>
                <span className="truncate text-meta text-muted">
                  {m.bothThree > 0 ? `둘 다 3스타 ${m.bothThree}곳` : `같이 평가한 곳 ${m.overlap}`} · 취향 일치 {Math.round(m.similarity * 100)}%
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

const DOT: Record<string, string> = {
  three: "bg-tier-3",
  two: "bg-pin-2",
  one: "bg-pin-1",
  notRecommended: "bg-pin-none",
};

// 리스트의 실제 장소 위치로 찍은 작은 미리보기 — 지도 타일 없이 점만
function MiniMap({ points }: { points: RecentList["points"] }) {
  if (points.length === 0) return <span aria-hidden="true" className="block h-24 rounded-btn-m bg-map-land" />;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const pos = (v: number, lo: number, hi: number) => (hi - lo < 1e-6 ? 50 : 12 + ((v - lo) / (hi - lo)) * 76);
  return (
    <span aria-hidden="true" className="relative block h-24 overflow-hidden rounded-btn-m bg-map-land">
      <span className="absolute inset-x-0 top-[46%] h-1.5 bg-white" />
      <span className="absolute inset-y-0 left-[38%] w-1.5 bg-white" />
      {points.map((p, i) => (
        <span
          key={i}
          className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${p.tier ? DOT[tierFromDb(p.tier)] : "bg-pin-none"}`}
          style={{ left: `${pos(p.lng, minLng, maxLng)}%`, top: `${100 - pos(p.lat, minLat, maxLat)}%` }}
        />
      ))}
    </span>
  );
}

export function RecentLists({ lists }: { lists: RecentList[] }) {
  if (lists.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title="새로 올라온 리스트" />
      <div className="grid grid-cols-2 gap-2.5 px-5">
        {lists.slice(0, 4).map((l) => (
          <Link key={l.id} href={`/l/${l.id}`} className="flex min-w-0 flex-col gap-1.5">
            <MiniMap points={l.points} />
            <span className="truncate text-body font-bold">{l.name}</span>
            <span className="truncate text-meta text-muted">
              {l.ownerNickname} · {l.count}곳
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
