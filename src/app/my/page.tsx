import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { AppHeader } from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TIER_LABEL, tierToDb, type Tier } from "@/domain/tier";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { countMyTiers, getMyLists } from "@/features/lists/lists";
import { getBio, getFollowCounts, getPerson } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "MY" };

const TILES: { tier: Tier; className: string; label: string }[] = [
  { tier: "three", className: "text-tier-3", label: TIER_LABEL.three },
  { tier: "two", className: "text-ink", label: TIER_LABEL.two },
  { tier: "one", className: "text-ink", label: TIER_LABEL.one },
  { tier: "notRecommended", className: "text-ink", label: "추천 안 함" },
  { tier: "wantToGo", className: "text-ink", label: "가고 싶은" },
];

export default function MyPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="tab" title="MY" right={
          <Link href="/settings/accounts" aria-label="설정" className="flex size-11 items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        } />
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
          <Avatar name={nickname} size={56} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-section font-bold">{nickname}</span>
            <span className="text-meta text-muted">
              팔로워 {counts.followers} · 팔로잉 {counts.following}
            </span>
          </div>
        </div>
        {bio && <p className="text-body leading-normal text-ink-2">{bio}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/my/edit" className="flex h-10 items-center justify-center rounded-btn-m bg-surface text-[14px] font-medium text-ink">
            프로필 수정
          </Link>
          <Link href={`/u/${me}`} className="flex h-10 items-center justify-center rounded-btn-m bg-surface text-[14px] font-medium text-ink">
            내 프로필 보기
          </Link>
        </div>
        <div className="grid grid-cols-5 divide-x divide-line rounded-[16px] bg-surface py-3.5">
          {TILES.map((t) => (
            <Link key={t.tier} href={`/map?tier=${t.tier}`} className="flex flex-col items-center gap-1">
              <b className={`text-[20px] leading-none ${t.className}`}>{tiers[tierToDb(t.tier)] ?? 0}</b>
              <span className="text-caption whitespace-nowrap text-muted">{t.label}</span>
            </Link>
          ))}
        </div>
        {(tiers.unrated ?? 0) > 0 && (
          <Link href="/rate" className="flex items-center justify-between gap-3 rounded-btn-l bg-surface px-4 py-3.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-bold">평가 전 {tiers.unrated}곳</span>
              <span className="text-meta text-muted">등급만 고르면 끝나요</span>
            </span>
            <span className="shrink-0 text-meta font-bold text-ink">빠르게 평가하기</span>
          </Link>
        )}
      </section>

      <nav aria-label="MY 메뉴" className="flex flex-col px-5 pt-4 pb-6">
        {[
          { href: "/lists", label: lists.length > 0 ? `내 리스트 ${lists.length}개` : "내 리스트", icon: "M6 3h12v18l-6-4-6 4z" },
          { href: "/people", label: "사람 찾기", icon: "M10 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM3 20c.8-3.5 3.6-5.5 7-5.5M15.5 15.5a3 3 0 1 0 4.2 4.2 3 3 0 0 0-4.2-4.2zM19.7 19.7L21 21" },
          { href: "/import", label: "저장한 장소 가져오기", icon: "M12 4v11M7 10l5 5 5-5M5 20h14" },
          { href: "/rate", label: "빠르게 평가하기", icon: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-14 items-center gap-3 border-b border-line text-body">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-2" aria-hidden="true">
              <path d={l.icon} />
            </svg>
            <span className="flex-1">{l.label}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-subtle" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </nav>
    </>
  );
}
