import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NICKNAME_SETUP } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countUnrated } from "@/features/rating/rating";

// 로그인 확인용 임시 홈 — 대시보드로 교체 예정
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-6 px-5 py-8">
      <Suspense fallback={<h1 className="text-title font-bold tracking-tight">반가워요</h1>}>
        <Greeting />
      </Suspense>
      <Suspense fallback={null}>
        <UnratedCard />
      </Suspense>
      <Link
        href="/map"
        className="flex h-btn-l items-center justify-center rounded-btn-l border border-line-strong text-[16px] font-bold text-ink"
      >
        내 장소 지도
      </Link>
      <Link
        href="/import"
        className="flex h-btn-l items-center justify-center rounded-btn-l bg-ink text-[16px] font-bold text-white"
      >
        저장한 장소 가져오기
      </Link>
      <Link
        href="/settings/accounts"
        className="flex h-btn-m items-center justify-center rounded-btn-m border border-line-strong text-body text-ink"
      >
        로그인 연결 관리
      </Link>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="h-btn-m w-full rounded-btn-m border border-line-strong text-body text-ink"
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}

// 쿠키(세션)를 읽는 부분만 요청 시점에 그린다
async function Greeting() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("nickname, nickname_set_at").eq("id", userId).single()
    : { data: null };
  if (profile && !profile.nickname_set_at) redirect(`${NICKNAME_SETUP}?next=/home`);
  return <h1 className="text-title font-bold tracking-tight">{profile?.nickname ?? "MY"}님, 반가워요</h1>;
}

// 평가 전이 남아 있으면 빠르게 평가하기로 — 없으면 아무것도 그리지 않는다
async function UnratedCard() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const unrated = userId ? await countUnrated(supabase, userId) : 0;
  if (unrated === 0) return null;
  return (
    <Link href="/rate" className="flex items-center justify-between gap-3 rounded-btn-l bg-surface px-4 py-3.5">
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-bold">평가 전 {unrated}곳</span>
        <span className="text-meta text-muted">한 곳씩 등급만 고르면 돼요</span>
      </span>
      <span className="shrink-0 text-meta font-bold text-ink">빠르게 평가하기</span>
    </Link>
  );
}
