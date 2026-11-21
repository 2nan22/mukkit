import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TIER_LABEL, TIERS, tierToDb, type Tier } from "@/domain/tier";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { SOURCE_LABEL } from "@/features/import/sources";
import { SourceMark } from "@/components/brand/BrandLogo";
import { countMyTiers, getImportedLists, getMyLists, VISIBILITY_LABEL } from "@/features/lists/lists";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "리스트" };

const TILE: Record<Tier, string> = {
  three: "bg-tier-3-soft text-tier-3",
  two: "bg-tier-2-soft text-tier-2",
  one: "bg-tier-1-soft text-tier-1",
  notRecommended: "bg-surface-2 text-ink-2",
  wantToGo: "bg-surface-2 text-ink-2",
  unrated: "border border-line text-ink-2",
};

export default function ListsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="tab" title="리스트" right={
          <Link href="/lists/new" aria-label="새 리스트 만들기" className="flex size-11 items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        } />
      <Suspense fallback={null}>
        <ListsContent />
      </Suspense>
      <div className="flex-1" />
      <div className="sticky bottom-0 mt-8">
        <BottomNav />
      </div>
    </main>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function ListsContent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const [tiers, lists, imported] = await Promise.all([
    countMyTiers(supabase, userId),
    getMyLists(supabase, userId),
    getImportedLists(supabase, userId),
  ]);

  return (
    <div className="flex flex-col gap-7 px-5 pt-2">
      <section className="flex flex-col gap-2">
        <h2 className="text-meta font-bold text-muted">등급별</h2>
        <div className="grid grid-cols-2 gap-2">
          {TIERS.map((t) => (
            <Link key={t} href={`/map?tier=${t}`} className={`flex h-btn-l items-center justify-between rounded-btn-m px-3.5 ${TILE[t]}`}>
              <span className="text-body font-bold">{TIER_LABEL[t]}</span>
              <span className="flex items-center gap-1.5 text-body font-bold text-ink">
                {tiers[tierToDb(t)] ?? 0}곳
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="opacity-50" aria-label="지도로 보기">
                  <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
        <span className="text-meta text-muted">평가하면 등급별로 모여요. 누르면 지도로 열려요</span>
      </section>

      <section className="flex flex-col">
        <h2 className="mb-1 text-meta font-bold text-muted">내 리스트</h2>
        {lists.map((l) => (
          <Link key={l.id} href={`/lists/${l.id}`} className="flex min-h-16 flex-col justify-center gap-0.5 border-b border-line py-2.5">
            <span className="truncate text-body font-bold">{l.name}</span>
            <span className="text-meta text-muted">
              {l.count}곳 · {VISIBILITY_LABEL[l.visibility]}
              {l.source && ` · ${SOURCE_LABEL[l.source]}에서 가져옴`}
            </span>
          </Link>
        ))}
        {lists.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-body font-semibold">아직 만든 리스트가 없어요</span>
            <span className="text-meta text-muted">지역 · 업종 · 테마로 저장한 곳을 묶어 보세요</span>
            <Link href="/lists/new" className="flex h-10 items-center rounded-btn-m bg-brand-soft px-4 text-body font-bold text-brand">
              새 리스트 만들기
            </Link>
          </div>
        )}
      </section>

      {imported.length > 0 && (
        <section className="flex flex-col">
          <h2 className="text-meta font-bold text-muted">가져온 리스트</h2>
          {imported.map((l) => (
            <Link
              key={`${l.source}:${l.sourceListId}`}
              href={`/lists/new?from=${l.source}:${encodeURIComponent(l.sourceListId)}`}
              className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-body">{l.name}</span>
                <span className="inline-flex items-center gap-1.5 text-meta text-muted">
                  <SourceMark source={l.source} size={14} />
                  {SOURCE_LABEL[l.source]} · {l.count}곳
                </span>
              </span>
              <span className="shrink-0 text-meta font-bold text-ink">리스트로 만들기</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
