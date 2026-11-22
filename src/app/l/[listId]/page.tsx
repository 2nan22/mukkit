import { getPlaceCovers } from "@/features/place/covers";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getPublicList } from "@/features/share/publicList";
import { PublicListView } from "@/features/share/PublicListView";
import { getListMeta, getMySavedPlaceIds } from "@/features/share/savedLists";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/l/[listId]">): Promise<Metadata> {
  const { listId } = await params;
  const list = await getPublicList(await createSupabaseServerClient(), listId);
  if (!list) return { title: "볼 수 없는 리스트", robots: { index: false } };
  const description = `${list.ownerNickname}님의 리스트 · ${list.places.length}곳${list.description ? ` · ${list.description}` : ""}`;
  return {
    title: list.name,
    description,
    openGraph: { title: list.name, description, type: "website" },
    // 링크 공유 리스트는 검색에 걸리지 않게
    robots: list.visibility === "public" ? undefined : { index: false },
  };
}

export default function PublicListPage({ params }: PageProps<"/l/[listId]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pb-28">
      <Suspense fallback={null}>
        <PublicListLoader params={params} />
      </Suspense>
    </main>
  );
}

// 링크로 들어온 사람은 로그인 없이 본다 — 공개 통로(public_list)만 쓴다
async function PublicListLoader({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const supabase = await createSupabaseServerClient();
  const [list, { data: claims }, meta] = await Promise.all([getPublicList(supabase, listId), supabase.auth.getClaims(), getListMeta(supabase, listId).catch(() => null)]);
  const me = claims?.claims?.sub ?? null;
  const signedIn = Boolean(me);

  if (!list) {
    return (
      <section className="flex flex-1 flex-col items-start gap-3 px-6 pt-24">
        <span className="text-body font-bold tracking-tight">마이슐랭</span>
        <h1 className="text-title font-bold tracking-tight">볼 수 없는 리스트예요</h1>
        <p className="text-body leading-relaxed text-ink-2">만든 사람이 비공개로 바꿨거나 지운 리스트예요. 링크를 보낸 사람에게 다시 받아 주세요.</p>
      </section>
    );
  }

  // 로그인한 남의 리스트 — 저장 · 담기. 저장해 둔 리스트면 본 시각을 갱신('새로 추가된 곳' 지움)
  const saveable = Boolean(me && meta && !meta.mine);
  // 갱신 전 본 시각을 먼저 읽어 '새로 추가' 표시에 쓴다
  const [savedPlaceIds, covers, seen] = await Promise.all([
    saveable && me ? getMySavedPlaceIds(supabase, me, list.places.map((p) => p.placeId)) : Promise.resolve([]),
    getPlaceCovers(supabase, list.places.map((p) => p.placeId)),
    meta?.saved && me ? supabase.from("saved_lists").select("last_seen_at").eq("user_id", me).eq("list_id", listId).maybeSingle() : Promise.resolve(null),
  ]);
  const seenAt = (seen?.data?.last_seen_at as string | undefined) ?? null;
  if (seenAt && me) await supabase.from("saved_lists").update({ last_seen_at: new Date().toISOString() }).eq("user_id", me).eq("list_id", listId);

  return (
    <>
      <header className="flex flex-col gap-1 px-5 pt-5 pb-4">
        <span className="text-meta font-semibold text-muted">{list.ownerNickname}님의 리스트</span>
        <h1 className="text-title font-bold tracking-tight">{list.name}</h1>
        <span className="text-meta text-muted">
          {list.places.length}곳{meta && meta.saves > 0 ? ` · ${meta.saves}명 저장` : ""}
          {list.description && ` · ${list.description}`}
        </span>
      </header>
      <PublicListView
        list={list}
        signedIn={signedIn}
        covers={Object.fromEntries([...covers].map(([id, c]) => [id, c.url]))}
        save={saveable && meta ? { saved: meta.saved, savedPlaceIds, seenAt } : null}
      />
      {!signedIn && (
        <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] bg-white px-5 pt-3 pb-5 shadow-sheet">
          <Link href="/" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
            마이슐랭에서 내 리스트 만들기
          </Link>
        </div>
      )}
    </>
  );
}
