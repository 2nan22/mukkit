import { AppHeader } from "@/components/AppHeader";
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
      <AppHeader kind="back" fallback="/home" title="여기서 뭐 먹지" />
      <p className="px-5 pb-4 text-meta leading-normal text-muted">
        내 기록과 팔로잉 · 취향 비슷한 사람의 평가에서만 골라요.
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
