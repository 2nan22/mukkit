import { AppHeader } from "@/components/AppHeader";
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
      <AppHeader kind="close" fallback="/home" title="빠르게 평가하기" />
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
  const [first, total] = await Promise.all([nextUnrated(supabase, userId, null), countUnrated(supabase, userId)]);
  return <QuickRate initial={first} total={total} />;
}
