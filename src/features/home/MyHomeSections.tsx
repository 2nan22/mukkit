import Link from "next/link";
import { CUISINE_ICON_PATH } from "@/components/ui/CuisineIcon";
import { TierIcon, TierSpoons } from "@/components/ui/TierIcon";
import { TIER_LABEL } from "@/domain/tier";
import type { RankPlace } from "@/features/rank/rank";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { HomeMiniMap } from "./HomeMiniMap";
import type { MyHome } from "./myHome";

const CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

function Head({ title, href, more }: { title: string; href?: string; more?: string }) {
  return (
    <div className="flex items-center justify-between px-5">
      <h2 className="text-section font-bold">{title}</h2>
      {href && (
        <Link href={href} className="flex h-11 items-center gap-0.5 text-meta text-muted">
          {more}
          {CHEVRON}
        </Link>
      )}
    </div>
  );
}

// 평가 전이 있으면 — 등급만 고르면 지도가 색으로 채워진다
export function QuickRate({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link href="/rate" className="mx-5 flex items-center justify-between gap-3 rounded-[16px] bg-ink px-4 py-3.5 text-white">
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-bold">평가 전 {count}곳</span>
        <span className="text-meta text-white/70">등급만 고르면 지도가 색으로 채워져요</span>
      </span>
      <span className="flex h-9 shrink-0 items-center rounded-full bg-white px-3.5 text-meta font-bold text-ink">빠르게 평가</span>
    </Link>
  );
}

// 내 지도 — 실제 카카오맵에 내 장소 핀, 누르면 지도 탭으로
export function MyMap({ home }: { home: MyHome }) {
  if (home.saved === 0) {
    return (
      <section className="flex flex-col gap-2">
        <Head title="내 지도" />
        <div className="mx-5 flex flex-col items-center gap-3 rounded-[16px] bg-surface px-4 py-6 text-center">
          <span className="text-body font-semibold">아직 저장한 곳이 없어요</span>
          <Link href="/import" className="flex h-11 items-center rounded-btn-m bg-white px-4 text-body font-bold text-ink">
            저장한 장소 가져오기
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <Head title="내 지도" href="/map" more="지도" />
      <Link href="/map" aria-label={`내 지도 열기 · 저장 ${home.saved}곳`} className="mx-5 flex flex-col overflow-hidden rounded-[16px] border border-line">
        <HomeMiniMap points={home.points} />
        <span className="grid grid-cols-3 divide-x divide-line py-2.5 text-body">
          <span className="flex items-center justify-center gap-1">
            저장 <b>{home.saved}</b>곳
          </span>
          <span className="flex items-center justify-center gap-1.5">
            <TierSpoons tier="three" height={12} />
            <b>{home.three}</b>
          </span>
          <span className="flex items-center justify-center gap-1.5">
            <TierIcon tier="wantToGo" height={13} />
            <b>{home.wantToGo}</b>
          </span>
        </span>
      </Link>
    </section>
  );
}

// 최근 저장한 곳 — 사진(내 사진 · 팔로잉) 없으면 업종 아이콘 · 아래에 등급 아이콘
export function RecentSaved({ home, covers }: { home: MyHome; covers: Record<string, string> }) {
  if (home.recent.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <Head title="최근 저장한 곳" href="/map" more="모두" />
      <ul className="flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {home.recent.map((p) => (
          <li key={p.placeId} className="shrink-0">
            <Link href={`/p/${p.placeId}`} className="flex w-[112px] flex-col gap-1.5">
              {covers[p.placeId] ? (
                // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
                <img src={covers[p.placeId]} alt="" loading="lazy" className="size-[112px] rounded-[14px] bg-surface object-cover" />
              ) : (
                <span aria-hidden="true" className="flex size-[112px] items-center justify-center rounded-[14px] bg-surface text-ink-2">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d={CUISINE_ICON_PATH[p.cuisine]} />
                  </svg>
                </span>
              )}
              <span className="truncate text-body font-semibold">{p.name}</span>
              <span className="flex items-center gap-1 text-meta text-muted">
                <TierIcon tier={p.tier} height={12} />
                {TIER_LABEL[p.tier]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 나만의 맛집 순위 — 정한 순위가 있을 때 1 ~ 3위
export function RankTop({ ranked }: { ranked: RankPlace[] }) {
  if (ranked.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <Head title="나만의 맛집 순위" href="/rank" more="순위" />
      <ol className="mx-5 flex flex-col rounded-[16px] border border-line">
        {ranked.slice(0, 3).map((p, i) => (
          <li key={p.placeId} className="border-b border-line last:border-b-0">
            <Link href={`/p/${p.placeId}`} className="flex h-12 items-center gap-3 px-4">
              <b className="w-4 text-body text-tier-3">{i + 1}</b>
              <span className="min-w-0 flex-1 truncate text-body font-semibold">{p.name}</span>
              <span className="shrink-0 text-meta text-muted">{CUISINE_LABEL[p.cuisine]}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
