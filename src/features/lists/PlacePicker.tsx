"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SourceMark } from "@/components/brand/BrandLogo";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL, type Cuisine } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { TIER_LABEL, TIERS, type Tier } from "@/domain/tier";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { countBy, EMPTY_CRITERIA, hasCriteria, matchPlaces, type Criteria } from "./criteria";
import type { PickablePlace } from "./pickablePlaces";
import { MetaLine } from "@/components/ui/MetaLine";

type Props = {
  places: PickablePlace[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  initialLabels?: string[];
  exclude?: Set<string>;
};

const REGIONS_SHOWN = 8;

// 지역 · 업종 · 라벨(원래 리스트) · 등급 · 테마 낱말을 고르면 내 저장 장소 중 맞는 곳을 추천하고, 거기서 체크해 담는다
export function PlacePicker({ places, selected, onChange, initialLabels = [], exclude }: Props) {
  const [criteria, setCriteria] = useState<Criteria>({ ...EMPTY_CRITERIA, labels: initialLabels });
  const [allRegions, setAllRegions] = useState(false);

  const pool = useMemo(() => (exclude ? places.filter((p) => !exclude.has(p.placeId)) : places), [places, exclude]);
  const regions = useMemo(() => countBy(pool, (p) => [regionOf(p.address)].filter((r): r is string => !!r)), [pool]);
  const cuisines = useMemo(() => countBy<Cuisine>(pool, (p) => [p.cuisine]), [pool]);
  const labels = useMemo(() => {
    const names = new Map<string, { name: string; source: PlaceSourceName }>();
    for (const p of pool) for (const o of p.origins) names.set(o.listKey, { name: o.listName, source: o.source });
    return countBy(pool, (p) => p.origins.map((o) => o.listKey)).map(([key, n]) => ({ key, n, ...names.get(key)! }));
  }, [pool]);

  const shown = useMemo(() => matchPlaces(pool, criteria), [pool, criteria]);
  const active = hasCriteria(criteria);
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.placeId));

  function toggleIn<K extends "regions" | "cuisines" | "labels" | "tiers">(key: K, value: Criteria[K][number]) {
    setCriteria((c) => {
      const list = c[key] as string[];
      const next = list.includes(value as string) ? list.filter((v) => v !== value) : [...list, value as string];
      return { ...c, [key]: next };
    });
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function toggleAllShown() {
    const next = new Set(selected);
    for (const p of shown) {
      if (allShownSelected) next.delete(p.placeId);
      else next.add(p.placeId);
    }
    onChange(next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-4 px-5 pb-3">
        <Group title="지역">
          {(allRegions ? regions : regions.slice(0, REGIONS_SHOWN)).map(([r, n]) => (
            <Chip key={r} pressed={criteria.regions.includes(r)} onClick={() => toggleIn("regions", r)}>
              {r} <Count n={n} />
            </Chip>
          ))}
          {regions.length > REGIONS_SHOWN && (
            <button type="button" onClick={() => setAllRegions((v) => !v)} className="h-9 px-1 text-meta text-ink-2 underline underline-offset-[3px]">
              {allRegions ? "접기" : `지역 ${regions.length - REGIONS_SHOWN}개 더 보기`}
            </button>
          )}
        </Group>

        <Group title="음식 종류">
          {cuisines.map(([c, n]) => (
            <Chip key={c} pressed={criteria.cuisines.includes(c)} onClick={() => toggleIn("cuisines", c)}>
              {CUISINE_LABEL[c]} <Count n={n} />
            </Chip>
          ))}
        </Group>

        {labels.length > 0 && (
          <Group title="가져온 리스트" hint="네이버나 카카오에서 가져온 리스트로 고를 수 있어요.">
            {labels.map((l) => (
              <Chip key={l.key} pressed={criteria.labels.includes(l.key)} onClick={() => toggleIn("labels", l.key)}>
                <SourceMark source={l.source} size={14} />
                {l.name} <Count n={l.n} />
              </Chip>
            ))}
          </Group>
        )}

        <Group title="등급">
          {TIERS.map((t: Tier) => (
            <Chip key={t} pressed={criteria.tiers.includes(t)} onClick={() => toggleIn("tiers", t)}>
              {TIER_LABEL[t]}
            </Chip>
          ))}
        </Group>

        <div className="flex flex-col gap-2">
          <label htmlFor="pick-keyword" className="text-meta font-bold">
            키워드
          </label>
          <input
            id="pick-keyword"
            value={criteria.keyword}
            onChange={(e) => setCriteria((c) => ({ ...c, keyword: e.target.value }))}
            placeholder="가게 이름이나 메모로 찾기"
            className="h-11 rounded-btn-m border border-line-strong px-3.5 text-body outline-none focus:border-ink"
          />
        </div>
      </div>

      <div className="sticky top-0 z-10 flex items-center justify-between border-y border-line bg-white px-5 py-2 text-meta">
        <MetaLine
          className="text-muted"
          items={[`${active ? "조건에 맞는 곳" : "저장한 곳 전체"} ${shown.length}곳`, <b key="selected" className="text-ink">{selected.size}곳 선택</b>]}
        />
        <span className="flex items-center gap-3">
          {active && (
            <button type="button" onClick={() => setCriteria(EMPTY_CRITERIA)} className="h-9 text-muted">
              초기화
            </button>
          )}
          <button type="button" onClick={toggleAllShown} disabled={shown.length === 0} className="h-9 font-bold text-ink disabled:text-muted">
            {allShownSelected ? "전체 해제" : "전체 선택"}
          </button>
        </span>
      </div>

      <ul className="px-5">
        {shown.map((p) => {
          const memo = p.note || p.origins.find((o) => o.memo)?.memo || "";
          return (
            <li key={p.placeId}>
              <label className="flex min-h-16 cursor-pointer items-center gap-3 border-b border-line py-2">
                <input type="checkbox" checked={selected.has(p.placeId)} onChange={() => toggle(p.placeId)} className="size-5 shrink-0 accent-ink" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-body">{p.name}</span>
                    <TierBadge tier={p.tier} />
                  </span>
                  <span className="flex items-center gap-1 truncate text-meta text-muted">
                    {[...new Set(p.origins.map((o) => o.source))].map((s) => (
                      <SourceMark key={s} source={s} size={12} />
                    ))}
                    <MetaLine className="" items={[CUISINE_LABEL[p.cuisine], regionOf(p.address), ...new Set(p.origins.map((o) => o.listName))]} />
                  </span>
                  {memo && <span className="truncate text-meta text-ink-2">{memo}</span>}
                </span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-8 text-center text-meta text-muted">조건에 맞는 곳이 없어요. 조건을 줄여 보세요.</li>}
      </ul>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section role="group" aria-label={title} className="flex flex-col gap-1.5">
      <h3 className="text-meta font-bold">{title}</h3>
      {hint && <p className="text-caption leading-normal text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-meta font-medium whitespace-nowrap ${
        pressed ? "bg-ink text-white" : "bg-surface text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="opacity-60">{n}</span>;
}
