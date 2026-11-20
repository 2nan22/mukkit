import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TIER_LABEL, tierToDb, type Tier } from "@/domain/tier";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { countMyTiers, getMyLists, VISIBILITY_LABEL } from "@/features/lists/lists";
import { getBio, getFollowCounts, getPerson } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "MY" };

const TILES: { tier: Tier; className: string; label: string }[] = [
  { tier: "three", className: "bg-tier-3-soft text-tier-3", label: TIER_LABEL.three },
  { tier: "two", className: "bg-tier-2-soft text-tier-2", label: TIER_LABEL.two },
  { tier: "one", className: "bg-tier-1-soft text-tier-1", label: TIER_LABEL.one },
  { tier: "notRecommended", className: "bg-surface-2 text-muted", label: TIER_LABEL.notRecommended },
  { tier: "wantToGo", className: "bg-surface-2 text-muted", label: "가고 싶은" },
];

export default function MyPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between pr-2 pl-5">
        <h1 className="text-section font-bold">MY</h1>
        <Link href="/settings/accounts" aria-label="설정" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </Link>
      </header>
      <main className="flex flex-1 flex-col">
        <Suspense fallback={null}>
          <MyContent />
        </Suspense>
      </main>
      <div className="sticky bottom-0">
        <BottomNav />
      </div>
    </div>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function MyContent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const [person, bio, counts, tiers, lists] = await Promise.all([
    getPerson(supabase, me),
    getBio(supabase, me),
    getFollowCounts(supabase, me),
    countMyTiers(supabase, me),
    getMyLists(supabase, me),
  ]);
  const nickname = person?.nickname ?? "";

  return (
    <>
      <section className="flex flex-col gap-4 border-b-8 border-surface px-5 pt-2 pb-5">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface-2 text-title font-bold text-ink-2">
            {nickname.slice(0, 1)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-section font-bold">{nickname}</span>
            <span className="text-meta text-muted">
              팔로워 {counts.followers} · 팔로잉 {counts.following}
            </span>
          </div>
        </div>
        {bio && <p className="text-body leading-normal text-ink-2">{bio}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/my/edit" className="flex h-btn-m items-center justify-center rounded-btn-m bg-surface-2 text-body text-ink">
            프로필 수정
          </Link>
          <Link href={`/u/${me}`} className="flex h-btn-m items-center justify-center rounded-btn-m bg-surface-2 text-body text-ink">
            남에게 보이는 내 프로필
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {TILES.map((t) => (
            <Link key={t.tier} href={`/map?tier=${t.tier}`} className={`flex flex-col gap-1 rounded-btn-m px-2 py-3 ${t.className}`}>
              <span className="text-caption font-bold whitespace-nowrap">{t.label}</span>
              <b className="text-section text-ink">{tiers[tierToDb(t.tier)] ?? 0}</b>
            </Link>
          ))}
        </div>
        {(tiers.unrated ?? 0) > 0 && (
          <Link href="/rate" className="flex items-center justify-between gap-3 rounded-btn-l bg-surface px-4 py-3.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-bold">평가 전 {tiers.unrated}곳</span>
              <span className="text-meta text-muted">한 곳씩 등급만 고르면 돼요</span>
            </span>
            <span className="shrink-0 text-meta font-bold text-ink">빠르게 평가하기</span>
          </Link>
        )}
      </section>

      <section className="flex flex-col px-5 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-section font-bold">리스트</h2>
          <Link href="/lists/new" className="flex h-btn-m items-center gap-1 text-meta text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            새 리스트 만들기
          </Link>
        </div>
        {lists.slice(0, 5).map((l) => (
          <Link key={l.id} href={`/lists/${l.id}`} className="flex min-h-16 flex-col justify-center gap-0.5 border-b border-line py-2">
            <span className="truncate text-body font-bold">{l.name}</span>
            <span className="text-meta text-muted">
              {l.count}곳 · {VISIBILITY_LABEL[l.visibility]}
            </span>
          </Link>
        ))}
        {lists.length > 5 && (
          <Link href="/lists" className="flex h-btn-m items-center text-meta text-ink-2">
            리스트 {lists.length}개 모두 보기
          </Link>
        )}
        {lists.length === 0 && <p className="py-4 text-meta text-muted">아직 만든 리스트가 없어요.</p>}
      </section>

      <nav aria-label="MY 메뉴" className="flex flex-col px-5 pt-4 pb-6">
        {[
          { href: "/people", label: "사람 찾기" },
          { href: "/import", label: "저장한 장소 가져오기" },
          { href: "/settings/accounts", label: "로그인 연결 · 로그아웃" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-12 items-center justify-between border-b border-line text-body">
            {l.label}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-muted" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </nav>
    </>
  );
}
