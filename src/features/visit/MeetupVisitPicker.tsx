"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { honor } from "@/domain/honor";
import { searchAll, type SearchResult } from "@/features/search/actions";
import { recordMeetupVisits, type MeetupVisitEntry } from "./actions";

const MAX_PLACES = 5;

type Person = { id: string; nickname: string };
type Entry = MeetupVisitEntry & { key: string; name: string };

// 끝낸 약속 — 간 곳을 1차 · 2차로 여러 곳, 가게마다 그 자리에 있던 사람을 골라 한 번에 기록
export function MeetupVisitPicker({ meetupId, people, startIndex, cancelHref }: { meetupId: string; people: Person[]; startIndex: number; cancelHref?: string }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => (q ? startSearch(async () => setResult(await searchAll(q, null))) : setResult(null)), 300);
    return () => clearTimeout(t);
  }, [query]);

  const all = people.map((p) => p.id);
  const full = entries.length >= MAX_PLACES;

  function add(e: Omit<Entry, "userIds">) {
    if (full || entries.some((x) => x.key === e.key)) return;
    setEntries([...entries, { ...e, userIds: all }]);
    setQuery("");
    setResult(null);
  }

  function toggle(key: string, id: string) {
    setEntries(entries.map((e) => (e.key !== key ? e : { ...e, userIds: e.userIds.includes(id) ? e.userIds.filter((x) => x !== id) : [...e.userIds, id] })));
  }

  async function save() {
    if (saving || entries.length === 0) return;
    setSaving(true);
    setError(null);
    const res = await recordMeetupVisits(
      meetupId,
      entries.map(({ placeId, kakao, userIds }) => ({ placeId, kakao, userIds })),
    );
    setSaving(false);
    if (res?.error) return setError(res.error);
    setEntries([]);
    router.replace(`/meet/${meetupId}/visit`);
  }

  const mineIds = new Set(result?.mine.map((m) => m.placeId));
  const places = (result?.places ?? []).filter((p) => !(p.placeId && mineIds.has(p.placeId)));

  return (
    <div className="flex flex-1 flex-col gap-4">
      {entries.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <h3 className="text-body font-semibold">추가할 곳</h3>
          {people.length > 0 && <span className="text-caption text-muted">이름을 누르면 빠지고, 다시 누르면 들어가요.</span>}
        </div>
      )}
      {entries.length > 0 && (
        <ol className="flex flex-col gap-2">
          {entries.map((e, i) => (
            <li key={e.key} className="flex flex-col gap-2 rounded-[16px] bg-white p-4 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-caption font-bold text-white">{startIndex + i + 1}차</span>
                <span className="min-w-0 flex-1 truncate text-body font-semibold">{e.name}</span>
                <button type="button" aria-label={`${e.name} 빼기`} onClick={() => setEntries(entries.filter((x) => x.key !== e.key))} className="-mr-2 flex size-11 items-center justify-center text-subtle">
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {people.length > 0 && <span className="text-caption text-muted">{e.userIds.length ? `함께한 사람 ${e.userIds.length}명` : "나 혼자"}</span>}
              {people.length > 0 && (
                <div role="group" aria-label={`${e.name}에 함께 있던 사람`} className="flex flex-wrap gap-x-1.5 gap-y-2">
                  {people.map((p) => {
                    const on = e.userIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(e.key, p.id)}
                        className={`relative h-9 rounded-full px-3 text-meta font-medium before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] ${on ? "bg-ink text-white" : "bg-surface text-muted"}`}
                      >
                        {honor(p.nickname)}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {!full && (
        <div className="flex flex-col gap-2">
          <input
            type="search"
            autoFocus={entries.length === 0}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={entries.length === 0 ? "가게 이름" : `${startIndex + entries.length + 1}차 가게 이름`}
            aria-label="간 가게 찾기"
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
                  meta={[CUISINE_LABEL[m.cuisine], m.region, "내 장소"]}
                  onClick={() => add({ key: m.placeId, name: m.name, placeId: m.placeId, kakao: null })}
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
                  meta={p.meta}
                  onClick={() => add({ key: p.placeId ?? `k${p.kakaoId}`, name: p.name, placeId: p.placeId, kakao: p.placeId ? null : { kakaoId: p.kakaoId, name: p.name, lat: p.lat, lng: p.lng } })}
                />
              </li>
            ))}
          </ul>
          {cancelHref && entries.length === 0 && (
            <a href={cancelHref} className="flex h-11 items-center self-center text-meta text-muted underline underline-offset-[3px]">
              그만 추가하기
            </a>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-2 border-t border-line bg-white px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {error && (
            <p role="alert" className="text-meta text-danger">
              {error}
            </p>
          )}
          <button type="button" disabled={saving} onClick={save} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand disabled:opacity-60">
            {saving ? "기록하는 중" : `${entries.length}곳 기록하기`}
          </button>
        </div>
      )}
    </div>
  );
}
