import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { TIER_LABEL, TIERS, tierToDb } from "@/domain/tier";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { SOURCE_LABEL } from "@/features/import/sources";
import { TierSpoons } from "@/components/ui/TierIcon";
import { ListThumb } from "@/components/ui/ListThumb";
import { countMyTiers, getImportedLists, getMyListThumbs, getMyLists, VISIBILITY_LABEL } from "@/features/lists/lists";
import { getMySavedLists } from "@/features/share/savedLists";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "리스트" };


export default function ListsPage({ searchParams }: PageProps<"/lists">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="tab" title="리스트" right={
          <Link href="/lists/new" aria-label="새 리스트 만들기" className="flex size-11 items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        } />
      <Suspense fallback={<ListSkeleton />}>
        <ListsContent searchParams={searchParams} />
      </Suspense>
      <div className="flex-1" />
      <div className="sticky bottom-0 mt-8">
        <BottomNav />
      </div>
    </main>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function ListsContent({ searchParams }: { searchParams: PageProps<"/lists">["searchParams"] }) {
  const byTier = (await searchParams).view === "tier";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const [tiers, lists, imported, saved] = await Promise.all([
    countMyTiers(supabase, userId),
    getMyLists(supabase, userId),
    getImportedLists(supabase, userId),
    getMySavedLists(supabase),
  ]);
  const thumbs = await getMyListThumbs(supabase, lists.map((l) => l.id));

  const unrated = tiers.unrated ?? 0;

  return (
    <div className="flex flex-col gap-6 px-5 pt-1">
      <nav aria-label="보기" className="grid grid-cols-2 rounded-full bg-surface p-1">
        {[
          { href: "/lists", label: "리스트", on: !byTier },
          { href: "/lists?view=tier", label: "등급", on: byTier },
        ].map((t) => (
          <Link key={t.label} href={t.href} replace aria-current={t.on ? "page" : undefined} className={`flex h-9 items-center justify-center rounded-full text-body ${t.on ? "bg-ink font-bold text-white" : "text-muted"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {byTier ? (
        <section className="flex flex-col">
          {unrated > 0 && (
            <Link href="/rate" className="mb-3 flex items-center justify-between gap-3 rounded-[16px] bg-ink px-4 py-3.5 text-white">
              <span className="flex flex-col gap-0.5">
                <span className="text-body font-bold">평가 전 {unrated}곳</span>
                <span className="text-meta text-white/70">등급만 고르면 돼요</span>
              </span>
              <span className="flex h-8 shrink-0 items-center rounded-full bg-brand px-3 text-meta font-bold">빠르게 평가</span>
            </Link>
          )}
          {TIERS.map((t) => {
            const n = tiers[tierToDb(t)] ?? 0;
            return (
              <Link key={t} href={`/map?tier=${t}`} className={`flex h-14 items-center gap-3 border-b border-line ${n === 0 ? "opacity-50" : ""}`}>
                <TierSpoons tier={t} />
                <span className="flex-1 text-body">{TIER_LABEL[t]}</span>
                <b className="text-body">{n}곳</b>
                <span className="flex items-center text-meta text-subtle">
                  지도
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </section>
      ) : (
        <>
        <section className="flex flex-col">
          <h2 className="mb-1 text-[16px] font-bold">내 리스트</h2>
          {lists.map((l) => (
            <Link key={l.id} href={`/lists/${l.id}`} className="flex min-h-20 items-center gap-3.5 border-b border-line py-3 last:border-b-0">
              {thumbs.get(l.id) ? (
                <ListThumb photos={thumbs.get(l.id)!.photos} cuisines={thumbs.get(l.id)!.cuisines} />
              ) : (
                <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-[10px] bg-surface text-subtle">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                    <path d="M6 3h12v18l-6-4-6 4z" />
                  </svg>
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body font-semibold">{l.name}</span>
                <span className="text-meta text-muted">
                  {l.count}곳 · {VISIBILITY_LABEL[l.visibility]}
                  {l.source && ` · ${SOURCE_LABEL[l.source]}`}
                </span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 text-subtle" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
          {/* 저장한 리스트가 있으면 빈 안내는 한 줄로 — 아래 칸을 밀어내지 않게 */}
          {lists.length === 0 && saved.length > 0 && (
            <Link href="/lists/new" className="flex h-11 items-center text-meta text-muted">
              아직 만든 리스트가 없어요 · <span className="ml-1 font-semibold text-ink">새 리스트 만들기</span>
            </Link>
          )}
          {lists.length === 0 && saved.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="text-body font-semibold">아직 만든 리스트가 없어요</span>
              <span className="text-meta text-muted">지역 · 음식 종류 · 테마로 저장한 곳을 묶어 보세요</span>
              <Link href="/lists/new" className="flex h-10 items-center rounded-btn-m bg-brand-soft px-4 text-body font-bold text-brand">
                새 리스트 만들기
              </Link>
            </div>
          )}
        </section>

        {/* 남의 리스트 — 공유 링크에서 '리스트 저장'. 주인이 새로 담은 곳은 표시 */}
        <section className="flex flex-col">
          <h2 className="mb-1 text-[16px] font-bold">저장한 리스트</h2>
          {saved.map((l) => (
            <Link key={l.id} href={`/l/${l.id}`} className="flex min-h-20 items-center gap-3.5 border-b border-line py-3 last:border-b-0">
              <ListThumb photos={[]} cuisines={l.cuisines} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body font-semibold">{l.name}</span>
                <span className="truncate text-meta text-muted">
                  {l.ownerNickname} · {l.count}곳 · {updatedLabel(l.updatedAt)}
                </span>
                {l.newCount > 0 && (
                  <span className="flex items-center gap-1 text-meta font-bold text-ink">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                    새로 추가된 곳 {l.newCount}
                  </span>
                )}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 text-subtle" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
          {saved.length === 0 && <p className="py-4 text-meta text-muted">공유받은 리스트에서 &lsquo;리스트 저장&rsquo;을 누르면 여기에 모여요.</p>}
        </section>
          {imported.length > 0 && (
            <Link href="/import/sources" className="flex h-12 items-center justify-between border-t border-line text-body">
              <span className="text-muted">가져온 원본 {imported.length}개</span>
              <span className="flex items-center gap-0.5 font-semibold">
                관리
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function updatedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "오늘 업데이트";
  if (days < 7) return `${days}일 전 업데이트`;
  if (days < 30) return `${Math.floor(days / 7)}주 전 업데이트`;
  return `${Math.floor(days / 30)}달 전 업데이트`;
}
