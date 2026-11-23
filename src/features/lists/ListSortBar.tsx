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

  // trailing: 같은 줄 오른쪽 끝에 붙일 것 (내 리스트의 '편집')
  const bar = (trailing?: React.ReactNode) => (
    <ListSortBar
      sort={sort}
      onSort={choose}
      present={present}
      tier={tiers[0] ?? null}
      onTier={(t) => setTiers(t ? [t] : [])}
      locating={locating}
      error={error}
      count={shown.length}
      total={items.length}
      trailing={trailing}
    />
  );
  return { shown, bar, distanceOf };
}

// 한 줄 — 왼쪽 개수, 오른쪽 [등급 ▾] [정렬 ▾]. 누르면 아래로 고르는 목록이 열린다
function ListSortBar({
  sort,
  onSort,
  present,
  tier,
  onTier,
  locating,
  error,
  count,
  total,
  trailing,
}: {
  sort: ListSort;
  onSort: (s: ListSort) => void;
  present: Tier[];
  tier: Tier | null;
  onTier: (t: Tier | null) => void;
  locating: boolean;
  error: string | null;
  count: number;
  total: number;
  trailing?: React.ReactNode;
}) {
  const [open, setOpen] = useState<"sort" | "tier" | null>(null);
  const toggle = (m: "sort" | "tier") => setOpen((v) => (v === m ? null : m));
  const button = (on: boolean) => `flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-meta font-medium whitespace-nowrap ${on ? "bg-ink text-white" : "bg-surface text-ink-2"}`;
  const caret = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
  const option = (label: React.ReactNode, on: boolean, pick: () => void, key: string) => (
    <li key={key}>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={on}
        onClick={() => {
          pick();
          setOpen(null);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-body text-ink"
      >
        <span className="flex items-center gap-1.5">{label}</span>
        {on && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
      </button>
    </li>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="mr-auto text-meta font-semibold text-ink-2">{tier ? `${total}곳 중 ${count}곳` : `${total}곳`}</span>
        {present.length > 1 && (
          <button type="button" aria-haspopup="menu" aria-expanded={open === "tier"} onClick={() => toggle("tier")} className={button(tier !== null)}>
            {tier ? TIER_LABEL[tier] : "등급"}
            {caret}
          </button>
        )}
        <button type="button" aria-haspopup="menu" aria-expanded={open === "sort"} onClick={() => toggle("sort")} className={button(false)}>
          {locating ? "위치 찾는 중" : LIST_SORT_LABEL[sort]}
          {caret}
        </button>
        {trailing}
      </div>
      {open && (
        <ul role="menu" aria-label={open === "sort" ? "정렬" : "등급"} className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-white">
          {open === "sort"
            ? LIST_SORTS.map((s) => option(LIST_SORT_LABEL[s], sort === s, () => onSort(s), s))
            : [
                option("전체", tier === null, () => onTier(null), "all"),
                ...present.map((t) =>
                  option(
                    <>
                      <TierIcon tier={t} height={14} />
                      {TIER_LABEL[t]}
                    </>,
                    tier === t,
                    () => onTier(t),
                    t,
                  ),
                ),
              ]}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
