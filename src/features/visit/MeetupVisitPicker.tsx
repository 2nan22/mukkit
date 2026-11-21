"use client";

import { useEffect, useState, useTransition } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { openKakaoPlace, searchAll, type SearchResult } from "@/features/search/actions";
import { recordMeetupVisit } from "./actions";

// 끝낸 약속 — 어디서 만났는지 고르기 (내 장소 먼저, 없으면 카카오 검색)
export function MeetupVisitPicker({ meetupId }: { meetupId: string }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => (q ? startSearch(async () => setResult(await searchAll(q, null))) : setResult(null)), 300);
    return () => clearTimeout(t);
  }, [query]);

  async function pick(key: string, resolve: () => Promise<string | null>) {
    if (saving) return;
    setSaving(key);
    setError(null);
    const placeId = await resolve();
    if (!placeId) {
      setSaving(null);
      return;
    }
    const res = await recordMeetupVisit(meetupId, placeId);
    if (res?.error) setError(res.error);
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="가게 이름"
        aria-label="만난 가게 찾기"
        className="h-12 rounded-[12px] bg-surface px-3.5 text-body outline-none focus:bg-white focus:ring-1 focus:ring-ink"
      />
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      {searching && !result && <span className="text-meta text-muted">찾는 중…</span>}
      {result && result.mine.length + result.places.length === 0 && <p className="py-6 text-center text-meta text-muted">찾는 가게가 없어요. 이름을 바꿔 보세요.</p>}
      <ul className="flex flex-col">
        {result?.mine.map((m) => (
          <li key={m.placeId}>
            <PlaceRow
              id={`mv-${m.placeId}`}
              name={m.name}
              cuisine={m.cuisine}
              tier={m.tier}
              meta={saving === m.placeId ? "기록하는 중…" : [CUISINE_LABEL[m.cuisine], m.region, "내 장소"].filter(Boolean).join(" · ")}
              onClick={() => pick(m.placeId, async () => m.placeId)}
            />
          </li>
        ))}
        {result?.places.map((p) => (
          <li key={p.kakaoId}>
            <PlaceRow
              id={`mv-k${p.kakaoId}`}
              name={p.name}
              cuisine={p.cuisine}
              tier={p.tier}
              meta={saving === p.kakaoId ? "기록하는 중…" : p.meta}
              onClick={() =>
                pick(p.kakaoId, async () => {
                  if (p.placeId) return p.placeId;
                  const res = await openKakaoPlace({ kakaoId: p.kakaoId, name: p.name, lat: p.lat, lng: p.lng });
                  if (!res.placeId) setError(res.error ?? "장소를 열지 못했어요");
                  return res.placeId ?? null;
                })
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
