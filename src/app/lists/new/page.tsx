import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { NewListForm } from "@/features/lists/NewListForm";
import { getPickablePlaces } from "@/features/lists/pickablePlaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "새 리스트" };

export default function NewListPage({ searchParams }: PageProps<"/lists/new">) {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/lists" aria-label="닫기" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">새 리스트</h1>
        <span />
      </header>
      <Suspense fallback={null}>
        <NewListLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function NewListLoader({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const places = await getPickablePlaces(supabase, userId);
  const origin = typeof from === "string" ? from : undefined;
  const originName = origin ? places.flatMap((p) => p.origins).find((o) => o.listKey === origin)?.listName : undefined;
  return <NewListForm places={places} initialOrigin={originName ? origin : undefined} initialName={originName} />;
}
