import { PageLoader } from "@/components/ui/EatingLoader";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { BlockedList } from "@/features/safety/BlockedList";
import { getMyBlocks } from "@/features/safety/safety";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "차단한 사람" };

export default function BlockedPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/settings" title="차단한 사람" />
      <p className="px-5 pb-2 text-meta text-muted">차단하면 서로의 평가 · 리스트가 보이지 않아요.</p>
      <section className="px-5">
        <Suspense fallback={<PageLoader />}>
          <Blocked />
        </Suspense>
      </section>
    </main>
  );
}

async function Blocked() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  return <BlockedList people={await getMyBlocks(supabase, me)} />;
}
