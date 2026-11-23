"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { openKakaoPlace, searchAll, type SearchResult } from "./actions";

const DEBOUNCE_MS = 300;

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const near = useRef<{ lat: number; lng: number } | null>(null);

  // 위치를 이미 허락했으면 가까운 순으로 — 묻지는 않는다
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(({ coords }) => {
          near.current = { lat: coords.latitude, lng: coords.longitude };
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search", { scroll: false });
      if (!q) return setResult(null);
      startSearch(async () => setResult(await searchAll(q, near.current)));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, router]);

  async function open(p: SearchResult["places"][number]) {
    setOpening(p.kakaoId);
    setError(null);
    const res = await openKakaoPlace({ kakaoId: p.kakaoId, name: p.name, lat: p.lat, lng: p.lng });
    setOpening(null);
    if (res.placeId) router.push(`/p/${res.placeId}`);
    else setError(res.error ?? "장소를 열지 못했어요");
  }

  const empty = result && result.mine.length + result.places.length + result.people.length === 0;

  return (
    <div className="flex flex-col gap-6 px-5 pb-10">
      <label className="flex h-12 items-center gap-2 rounded-[12px] bg-surface px-3.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="가게 이름, 닉네임"
          aria-label="검색어"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-body outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="flex size-7 items-center justify-center rounded-full text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </label>

      {!query.trim() && <p className="whitespace-pre-line pt-6 text-center text-meta leading-normal text-muted">가게 이름으로 저장한 곳과 새 장소를,{"\n"}닉네임으로 사람을 찾을 수 있어요.</p>}
      {searching && !result && <p className="text-center text-meta text-muted">찾는 중이에요</p>}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      {result?.mineFailed && (
        <p role="alert" className="text-meta text-danger">
          저장한 곳을 찾지 못했어요. 잠시 뒤 다시 검색해 주세요.
        </p>
      )}
      {empty && !searching && !result?.mineFailed && <p className="pt-6 text-center text-meta text-muted">검색 결과가 없어요</p>}

      {result && result.mine.length > 0 && (
        <Section title="내가 저장한 곳">
          {result.mine.map((p) => (
            <PlaceRow key={p.placeId} href={`/p/${p.placeId}`} name={p.name} cuisine={p.cuisine} tier={p.tier} meta={[CUISINE_LABEL[p.cuisine], p.region].filter(Boolean).join(" · ")} />
          ))}
        </Section>
      )}

      {result && result.people.length > 0 && (
        <Section title="사람">
          {result.people.map((p) => (
            <Link key={p.id} href={`/u/${p.id}`} className="flex min-h-14 items-center gap-3">
              <Avatar name={p.nickname} size={40} />
              <span className="truncate text-body font-semibold">{p.nickname}</span>
            </Link>
          ))}
        </Section>
      )}

      {result && result.places.length > 0 && (
        <Section title="장소" hint="카카오맵 검색 결과예요. 눌러서 저장하거나 평가할 수 있어요.">
          {result.places.map((p) =>
            p.placeId ? (
              <PlaceRow key={p.kakaoId} href={`/p/${p.placeId}`} name={p.name} cuisine={p.cuisine} tier={p.tier} meta={p.meta} />
            ) : (
              <PlaceRow
                key={p.kakaoId}
                onClick={() => open(p)}
                name={p.name}
                cuisine={p.cuisine}
                meta={opening === p.kakaoId ? "여는 중이에요" : p.meta}
              />
            ),
          )}
        </Section>
      )}

    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <h2 className="text-[16px] font-bold">{title}</h2>
      {hint && <p className="pt-0.5 pb-1 text-meta text-muted">{hint}</p>}
      <div className="flex flex-col">{children}</div>
    </section>
  );
}
