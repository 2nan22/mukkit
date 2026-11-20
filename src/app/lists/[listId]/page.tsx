import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { ListDetail } from "@/features/lists/ListDetail";
import { getMyList } from "@/features/lists/lists";
import { getPickablePlaces } from "@/features/lists/pickablePlaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "리스트" };

export default function ListPage({ params }: PageProps<"/lists/[listId]">) {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-y-auto">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/lists" aria-label="리스트로" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">내 리스트</h1>
        <span />
      </header>
      <Suspense fallback={null}>
        <ListLoader params={params} />
      </Suspense>
    </main>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function ListLoader({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const list = /^[0-9a-f-]{36}$/.test(listId) ? await getMyList(supabase, userId, listId) : null;
  if (!list) notFound();
  const places = await getPickablePlaces(supabase, userId);
  return <ListDetail list={list} places={places} />;
}
