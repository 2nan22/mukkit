"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { TierIcon } from "@/components/ui/TierIcon";
import { distanceLabel, LIST_SORT_LABEL, LIST_SORTS, metersBetween, sortListPlaces, type ListSort } from "@/domain/listSort";
import { TIER_LABEL, TIERS, type Tier } from "@/domain/tier";

type Item = { name: string; lat: number; lng: number; tier: Tier | null };
type Point = { lat: number; lng: number };

const SORT_KEY = "mk_list_sort";

// 고른 정렬은 이 기기에 기억 — 가까운 순은 위치를 다시 받아야 해서 담은 순으로 시작
function readSort(): ListSort {
  try {
    const v = window.localStorage.getItem(SORT_KEY);
    return v && (LIST_SORTS as readonly string[]).includes(v) && v !== "near" ? (v as ListSort) : "added";
  } catch {
    return "added";
  }
}

const noSubscribe = () => () => undefined;

// 리스트 안 정렬 · 등급 거르기 — 내 리스트 상세와 공유 리스트가 함께 쓴다
export function useListSort<T extends Item>(items: readonly T[]) {
  // 서버 그림은 담은 순, 브라우저에서 기억한 정렬로 — 처음 그림이 어긋나지 않게
  const stored = useSyncExternalStore(noSubscribe, readSort, () => "added" as ListSort);
  const [picked, setSort] = useState<ListSort | null>(null);
  const sort = picked ?? stored;
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [me, setMe] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(next: ListSort) {
    setError(null);
    if (next !== "near") {
      setSort(next);
      try {
        window.localStorage.setItem(SORT_KEY, next);
      } catch {
        // 기억 못 해도 정렬은 된다
      }
      return;
    }
    if (me) return setSort("near");
    if (!navigator.geolocation) return setError("이 브라우저에서는 위치를 쓸 수 없어요");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setMe({ lat: coords.latitude, lng: coords.longitude });
        setSort("near");
      },
      (err) => {
        setLocating(false);
        setError(err.code === err.PERMISSION_DENIED ? "위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요" : "지금은 위치를 찾을 수 없어요");
      },
      { maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  }

  // 이 리스트에 있는 등급만 칩으로 — 없는 등급 칩은 눌러도 빈 목록이라 보이지 않게
  const present = useMemo(() => TIERS.filter((t) => items.some((p) => p.tier === t)), [items]);
  const shown = useMemo(() => sortListPlaces(items, sort, { tiers, me: sort === "near" ? me : null }), [items, sort, tiers, me]);
  const distanceOf = (p: Point) => (sort === "near" && me ? distanceLabel(metersBetween(me, p)) : null);

  const bar = (
    <ListSortBar
      sort={sort}
      onSort={choose}
      present={present}
      tiers={tiers}
      onTiers={setTiers}
      locating={locating}
      error={error}
      count={shown.length}
      total={items.length}
    />
  );
  return { shown, bar, distanceOf };
}

function ListSortBar({
  sort,
  onSort,
  present,
  tiers,
  onTiers,
  locating,
  error,
  count,
  total,
}: {
  sort: ListSort;
  onSort: (s: ListSort) => void;
  present: Tier[];
  tiers: Tier[];
  onTiers: (t: Tier[]) => void;
  locating: boolean;
  error: string | null;
  count: number;
  total: number;
}) {
  const chip = (on: boolean) => `flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-meta font-medium whitespace-nowrap ${on ? "bg-ink text-white" : "bg-surface text-ink-2"}`;
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="정렬" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {LIST_SORTS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={sort === s} onClick={() => onSort(s)} className={chip(sort === s)}>
            {s === "near" && locating ? "위치 찾는 중" : LIST_SORT_LABEL[s]}
          </button>
        ))}
      </div>
      {present.length > 1 && (
        <div role="group" aria-label="등급 거르기" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
          <button type="button" aria-pressed={tiers.length === 0} onClick={() => onTiers([])} className={chip(tiers.length === 0)}>
            전체
          </button>
          {present.map((t) => {
            const on = tiers.includes(t);
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => onTiers(on ? tiers.filter((x) => x !== t) : [...tiers, t])} className={chip(on)}>
                <TierIcon tier={t} height={13} color={on ? "#ffffff" : undefined} />
                {TIER_LABEL[t]}
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      {tiers.length > 0 && (
        <p className="text-meta text-muted">
          {total}곳 중 {count}곳
        </p>
      )}
    </div>
  );
}
