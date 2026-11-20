import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { QuickRate } from "@/features/rating/QuickRate";
import { countUnrated, nextUnrated } from "@/features/rating/rating";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "빠르게 평가하기" };

export default function QuickRatePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/home" aria-label="닫기" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">빠르게 평가하기</h1>
        <span />
      </header>
      <Suspense fallback={null}>
        <QuickRateLoader />
      </Suspense>
    </main>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function QuickRateLoader() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const [first, total] = await Promise.all([nextUnrated(supabase, userId, []), countUnrated(supabase, userId)]);
  return <QuickRate initial={first} total={total} />;
}
