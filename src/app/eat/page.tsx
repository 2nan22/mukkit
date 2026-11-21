import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getMyTasteBasis } from "@/features/eat/eat";
import { EatView } from "@/features/eat/EatView";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "여기서 뭐 먹지" };

export default function EatPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/home" aria-label="홈으로" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">여기서 뭐 먹지</h1>
        <span />
      </header>
      <p className="px-5 pb-4 text-meta leading-normal text-muted">
        내 평가와 가고 싶은 곳, 팔로우한 사람과 취향이 비슷한 사람의 평가를 모아 업종별로 골라 드려요. 가게 평균 점수는 쓰지 않아요.
      </p>
      <Suspense fallback={null}>
        <EatLoader />
      </Suspense>
    </main>
  );
}

async function EatLoader() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const { regions } = await getMyTasteBasis(supabase, me);
  return <EatView regions={regions} />;
}
