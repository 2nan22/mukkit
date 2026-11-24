import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ListThumb, topCuisines } from "@/components/ui/ListThumb";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getPlaceCovers } from "@/features/place/covers";
import { getPopularPublicLists } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MetaLine } from "@/components/ui/MetaLine";

export const metadata = { title: "공개 리스트" };

// 홈 '요즘 많이 저장된 리스트' 전체보기 — 공개 리스트 40개까지
export default function PopularListsPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" title="많이 저장된 리스트" fallback="/home" />
      <main className="flex flex-1 flex-col pb-10">
        <Suspense fallback={<ListSkeleton />}>
          <Grid />
        </Suspense>
      </main>
    </div>
  );
}

async function Grid() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  const lists = await getPopularPublicLists(supabase, 40);
  const covers = Object.fromEntries([...(await getPlaceCovers(supabase, lists.flatMap((l) => l.points.map((p) => p.placeId))))].map(([id, c]) => [id, c.url]));
  if (lists.length === 0) {
    return <p className="px-5 py-16 text-center text-meta text-muted">아직 공개된 리스트가 없어요.</p>;
  }
  return (
    <>
      <p className="px-5 pb-3 text-meta text-muted">{lists.some((l) => (l.saves ?? 0) > 0) ? "최근 30일 동안 많이 저장된 순이에요." : "최근에 올라온 순이에요."}</p>
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 px-5">
        {lists.map((l) => (
          <Link key={l.id} href={`/l/${l.id}`} className="flex min-w-0 flex-col gap-1.5">
            <ListThumb
              size="card"
              count={l.count}
              photos={l.points.flatMap((p) => (covers[p.placeId] ? [covers[p.placeId]] : [])).slice(0, 4)}
              cuisines={topCuisines(l.points)}
            />
            <span className="truncate text-body font-bold">{l.name}</span>
            <MetaLine items={[l.ownerNickname, l.saves ? `${l.saves}명 저장` : null]} />
          </Link>
        ))}
      </div>
    </>
  );
}
