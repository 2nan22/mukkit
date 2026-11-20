import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TIER_LABEL, TIERS, tierToDb, type Tier } from "@/domain/tier";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { SOURCE_LABEL } from "@/features/import/sources";
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
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pb-8">
      <header className="flex h-14 items-center justify-between pr-2 pl-2">
        <Link href="/home" aria-label="홈으로" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-section font-bold">리스트</h1>
        <Link href="/lists/new" aria-label="새 리스트 만들기" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </header>
      <Suspense fallback={null}>
        <ListsContent />
      </Suspense>
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
              <span className="text-body font-bold text-ink">{tiers[tierToDb(t)] ?? 0}곳</span>
            </Link>
          ))}
        </div>
        <span className="text-meta text-muted">등급별 리스트는 평가하면 자동으로 채워져요. 누르면 지도로 봐요.</span>
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
        <Link href="/lists/new" className="flex min-h-14 items-center gap-3 text-body text-ink-2">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-btn-m bg-surface">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          새 리스트 만들기
        </Link>
      </section>

      {imported.length > 0 && (
        <section className="flex flex-col">
          <h2 className="text-meta font-bold text-muted">가져온 원본 리스트</h2>
          <p className="mb-1 text-meta leading-normal text-muted">네이버 · 카카오에서 가져온 그대로예요. 골라서 새 리스트를 만들 수 있어요.</p>
          {imported.map((l) => (
            <Link
              key={`${l.source}:${l.sourceListId}`}
              href={`/lists/new?from=${l.source}:${encodeURIComponent(l.sourceListId)}`}
              className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-body">{l.name}</span>
                <span className="text-meta text-muted">
                  {SOURCE_LABEL[l.source]} · {l.count}곳
                </span>
              </span>
              <span className="shrink-0 text-meta font-bold text-ink">골라서 만들기</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
