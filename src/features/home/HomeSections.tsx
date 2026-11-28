import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { ListThumb, topCuisines } from "@/components/ui/ListThumb";
import { FollowButton } from "@/features/social/FollowButton";
import type { RecentList, TasteMatch } from "@/features/social/social";
import { MetaLine } from "@/components/ui/MetaLine";

export function SectionHead({ title, sub, more }: { title: string; sub?: string; more?: string }) {
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
                <MetaLine items={[m.bothThree > 0 ? `둘 다 3숟가락 ${m.bothThree}곳` : `같이 평가한 곳 ${m.overlap}곳`, `취향 일치 ${Math.round(m.similarity * 100)}%`]} />
              </span>
            </Link>
            <FollowButton targetId={m.userId} following={false} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}



// 저장된 리스트가 하나라도 있으면 '요즘 많이 저장된', 아직 없으면 '새로 올라온' — 제목이 사실과 맞게
export function RecentLists({ lists, covers = {} }: { lists: RecentList[]; covers?: Record<string, string> }) {
  if (lists.length === 0) return null;
  const popular = lists.some((l) => (l.saves ?? 0) > 0);
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead title={popular ? "요즘 많이 저장된 리스트" : "새로 올라온 리스트"} more="/lists/popular" />
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
            <MetaLine items={[l.ownerNickname, l.saves ? `${l.saves}명 저장` : null]} />
          </Link>
        ))}
      </div>
    </section>
  );
}
