"use client";

import { useEffect, useState, useTransition } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { openKakaoPlace, searchAll, type SearchResult } from "@/features/search/actions";
import { recordMeetupVisit } from "./actions";

type Choice = { key: string; name: string; placeId: string | null; kakao?: { kakaoId: string; name: string; lat: number; lng: number } };

// 끝낸 약속 — 어디서 만났는지 고르고 확정 (잘못 눌러 요청이 바로 가지 않게)
export function MeetupVisitPicker({ meetupId }: { meetupId: string }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => (q ? startSearch(async () => setResult(await searchAll(q, null))) : setResult(null)), 300);
    return () => clearTimeout(t);
  }, [query]);

  async function confirm() {
    if (!choice || saving) return;
    setSaving(true);
    setError(null);
    let placeId = choice.placeId;
    if (!placeId && choice.kakao) {
      const res = await openKakaoPlace(choice.kakao);
      if (!res.placeId) {
        setError(res.error ?? "장소를 열지 못했어요");
        setSaving(false);
        return;
      }
      placeId = res.placeId;
    }
    const res = await recordMeetupVisit(meetupId, placeId!);
    if (res?.error) setError(res.error);
    setSaving(false);
  }

  const mineIds = new Set(result?.mine.map((m) => m.placeId));
  const places = (result?.places ?? []).filter((p) => !(p.placeId && mineIds.has(p.placeId)));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="가게 이름"
        aria-label="만난 가게 찾기"
        className="h-12 rounded-[12px] bg-surface px-3.5 text-body outline-none focus:bg-white focus:ring-1 focus:ring-ink [&::-webkit-search-cancel-button]:appearance-none"
      />
      {searching && !result && <span className="text-meta text-muted">찾는 중…</span>}
      {result && result.mine.length + places.length === 0 && <p className="py-6 text-center text-meta text-muted">찾는 가게가 없어요. 이름을 바꿔 보세요.</p>}
      <ul className="flex flex-col">
        {result?.mine.map((m) => (
          <li key={m.placeId}>
            <PlaceRow
              id={`mv-${m.placeId}`}
              name={m.name}
              cuisine={m.cuisine}
              tier={m.tier}
              selected={choice?.key === m.placeId}
              meta={[CUISINE_LABEL[m.cuisine], m.region, "내 장소"].filter(Boolean).join(" · ")}
              onClick={() => setChoice({ key: m.placeId, name: m.name, placeId: m.placeId })}
            />
          </li>
        ))}
        {places.map((p) => (
          <li key={p.kakaoId}>
            <PlaceRow
              id={`mv-k${p.kakaoId}`}
              name={p.name}
              cuisine={p.cuisine}
              tier={p.tier}
              selected={choice?.key === p.kakaoId}
              meta={p.meta}
              onClick={() => setChoice({ key: p.kakaoId, name: p.name, placeId: p.placeId, kakao: { kakaoId: p.kakaoId, name: p.name, lat: p.lat, lng: p.lng } })}
            />
          </li>
        ))}
      </ul>

      {choice && (
        <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-2 border-t border-line bg-white px-5 pt-3 pb-5">
          {error && (
            <p role="alert" className="text-meta text-danger">
              {error}
            </p>
          )}
          <button type="button" disabled={saving} onClick={confirm} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand disabled:opacity-60">
            {saving ? "기록하는 중" : "이 가게로 기록"}
          </button>
        </div>
      )}
    </div>
  );
}
