import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { AppHeader } from "@/components/AppHeader";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { getTasteMatches, searchPeople } from "@/features/social/social";
import { TasteMatches } from "@/features/social/TasteMatches";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "사람 찾기" };

export default function PeoplePage({ searchParams }: PageProps<"/people">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/home" title="사람 찾기" />
      <Suspense fallback={<ListSkeleton />}>
        <People searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function People({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const [people, matches] = await Promise.all([
    searchPeople(supabase, query, data?.claims?.sub ?? null),
    query ? Promise.resolve([]) : getTasteMatches(supabase, 10),
  ]);

  return (
    <div className="flex flex-col gap-3 px-5">
      <form action="/people" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          닉네임
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="닉네임으로 찾기"
          className="h-12 min-w-0 flex-1 rounded-[12px] border border-transparent bg-surface px-3.5 text-body outline-none focus:border-ink focus:bg-white"
        />
        <button type="submit" className="h-12 shrink-0 rounded-[12px] bg-surface px-4 text-body font-semibold text-ink">
          찾기
        </button>
      </form>
      {!query && <TasteMatches matches={matches} title="취향이 비슷한 사람" />}
      <ul>
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/u/${p.id}`} className="flex min-h-14 items-center gap-3 border-b border-line">
              <Avatar name={p.nickname} size={40} />
              <span className="flex-1 truncate text-body font-semibold">{p.nickname}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-subtle" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
        {query && people.length === 0 && <li className="py-8 text-center text-meta text-muted">검색 결과가 없어요</li>}
      </ul>
    </div>
  );
}
