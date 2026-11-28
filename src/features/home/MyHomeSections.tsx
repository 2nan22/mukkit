import Link from "next/link";
import { FoodArt } from "@/components/ui/CuisineIcon";
import { TierIcon } from "@/components/ui/TierIcon";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { TIER_LABEL, type Tier } from "@/domain/tier";
import type { RankPlace } from "@/features/rank/rank";
import { SectionHead } from "./HomeSections";
import { HomeMapCard } from "./HomeMiniMap";
import type { MyHome } from "./myHome";

// 등급 집계 (DB 값 기준 키) — countMyTiers
export type TierCounts = Record<string, number>;

export function MyMap({ home, tiers }: { home: MyHome; tiers: TierCounts }) {
  const saved = Object.values(tiers).reduce((a, b) => a + b, 0);
  const three = tiers.three ?? 0;
  const want = tiers.want_to_go ?? 0;
  if (saved === 0) {
    return (
      <section className="flex flex-col gap-2">
        <SectionHead title="내 지도" />
        <div className="mx-5 flex flex-col items-center gap-1 rounded-[16px] bg-surface px-4 py-6 text-center">
          <span className="text-body font-semibold">아직 저장한 곳이 없어요</span>
          <span className="text-meta text-muted">네이버나 카카오 리스트를 링크로 가져와요</span>
          <Link href="/import" className="mt-2 flex h-11 items-center rounded-btn-m bg-white px-4 text-body font-bold text-ink">
            저장한 장소 가져오기
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <SectionHead title="내 지도" />
      <HomeMapCard points={home.points} total={{ saved, three, want }} />
    </section>
  );
}

const RATED: Tier[] = ["three", "two", "one", "notRecommended"];

// 최근 저장한 곳 — 사진(내 사진 · 팔로잉) 없으면 세부 업종 기본 그림 · 아래에 등급(평가 전은 업종)
export function RecentSaved({ home, covers }: { home: MyHome; covers: Record<string, string> }) {
  if (home.recent.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <SectionHead title="최근 저장한 곳" />
      <ul className="relative flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {home.recent.map((p) => (
          <li key={p.placeId} className="shrink-0">
            <Link href={`/p/${p.placeId}`} className="flex w-[112px] flex-col gap-1.5">
              {covers[p.placeId] ? (
                // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
                <img src={covers[p.placeId]} alt="" loading="lazy" className="size-[112px] rounded-[14px] bg-surface object-cover" />
              ) : (
                <span aria-hidden="true" className="flex size-[112px] items-center justify-center rounded-[14px] bg-surface">
                  <FoodArt cuisine={p.cuisine} kind={p.kind} size={64} />
                </span>
              )}
              <span className="truncate text-body font-semibold">{p.name}</span>
              <span className="flex items-center gap-1 truncate text-meta text-muted">
                {RATED.includes(p.tier) || p.tier === "wantToGo" ? (
                  <>
                    <TierIcon tier={p.tier} height={12} />
                    {TIER_LABEL[p.tier]}
                  </>
                ) : (
                  CUISINE_LABEL[p.cuisine]
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 나만의 맛집 순위 — 정한 순위가 2곳 이상이면 1 ~ 3위, 안 정한 3숟가락이 2곳 이상이면 정해 보기
export function RankTop({ ranked, unranked }: { ranked: RankPlace[]; unranked: number }) {
  if (ranked.length < 2) {
    if (unranked + ranked.length < 2) return null;
    return (
      <Link href="/rank" className="mx-5 flex min-h-12 items-center justify-between gap-3 rounded-[16px] bg-surface px-4">
        <span className="text-body">
          3숟가락 <b>{unranked + ranked.length}곳</b>의 순위를 정해 보세요
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <SectionHead title="나만의 맛집 순위" more="/rank" />
      <ol className="mx-5 flex flex-col rounded-[16px] border border-line">
        {ranked.slice(0, 3).map((p, i) => (
          <li key={p.placeId} className="border-b border-line last:border-b-0">
            <Link href={`/p/${p.placeId}`} className="flex h-12 items-center gap-3 px-4">
              <b className="w-4 text-body text-ink">{i + 1}</b>
              <span className="min-w-0 flex-1 truncate text-body font-semibold">{p.name}</span>
              <span className="shrink-0 text-meta text-muted">{CUISINE_LABEL[p.cuisine]}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
