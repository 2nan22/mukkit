import { AppHeader } from "@/components/AppHeader";
import { headers } from "next/headers";
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
      <AppHeader kind="back" fallback="/lists" title="리스트" />
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
  const [places, h] = await Promise.all([getPickablePlaces(supabase, userId), headers()]);
  // 공유 링크는 지금 접속한 주소 기준 — 배포하면 그 도메인이 된다
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return <ListDetail list={list} places={places} origin={origin} />;
}
