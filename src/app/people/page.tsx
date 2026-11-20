import Link from "next/link";
import { Suspense } from "react";
import { searchPeople } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "사람 찾기" };

export default function PeoplePage({ searchParams }: PageProps<"/people">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/settings/accounts" aria-label="MY 로" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">사람 찾기</h1>
        <span />
      </header>
      <Suspense fallback={null}>
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
  const people = await searchPeople(supabase, query, data?.claims?.sub ?? null);

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
          className="h-12 min-w-0 flex-1 rounded-btn-m border border-line-strong px-3.5 text-body outline-none focus:border-ink"
        />
        <button type="submit" className="h-12 shrink-0 rounded-btn-m bg-ink px-4 text-body font-bold text-white">
          찾기
        </button>
      </form>
      <ul>
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/u/${p.id}`} className="flex min-h-14 items-center gap-3 border-b border-line">
              <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-meta font-bold text-ink-2">
                {p.nickname.slice(0, 1)}
              </span>
              <span className="text-body">{p.nickname}</span>
            </Link>
          </li>
        ))}
        {query && people.length === 0 && <li className="py-8 text-center text-meta text-muted">그 닉네임을 쓰는 사람이 없어요.</li>}
      </ul>
    </div>
  );
}
