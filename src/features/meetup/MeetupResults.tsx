"use client";

import { useMemo, useState } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { areaReason } from "@/domain/meetup";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { AreaPlan } from "./meetup";

function km(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

// 두 분에게 좋은 지역 3곳 · 지역마다 가게 — 지도는 고른 지역의 가게
export function MeetupResults({ plans, partnerNickname }: { plans: AreaPlan[]; partnerNickname: string }) {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const plan = plans[active];
  const pins = useMemo(() => (plan?.shops ?? []).map((s) => ({ id: s.placeId, lat: s.lat, lng: s.lng, tier: s.myTier ?? "two" })), [plan]);

  if (plans.length === 0) return <p className="py-8 text-center text-meta text-muted">맞는 지역을 찾지 못했어요. 위치를 다시 확인해 주세요.</p>;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-section font-bold">두 분에게 좋은 곳</h2>
        <span className="text-meta text-muted">이동 시간 · 막차는 직선거리로 어림한 값이에요.</span>
      </div>
      <div role="tablist" aria-label="추천 지역" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {plans.map((p, i) => (
          <button
            key={p.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => { setActive(i); setSelected(null); }}
            className={`h-9 shrink-0 rounded-full px-3.5 text-meta font-medium ${i === active ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
          >
            {i + 1}. {p.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 rounded-[16px] bg-surface p-4">
        <span className="text-body font-semibold">{plan.name}</span>
        <span className="text-meta text-ink-2">{areaReason(plan.myMinutes, plan.partnerMinutes)}</span>
        {(plan.myLast || plan.partnerLast) && (
          <span className="text-meta text-muted">
            막차 어림 —{" "}
            {[plan.myLast && `나 ${plan.myLast}`, plan.partnerLast && `${partnerNickname}님 ${plan.partnerLast}`].filter(Boolean).join(" · ")} 출발
          </span>
        )}
        {(plan.myLate || plan.partnerLate) && (
          <span className="text-meta font-medium text-danger">
            {[plan.myLate && "나", plan.partnerLate && `${partnerNickname}님`].filter(Boolean).join(" · ")}은 끝나는 시간이 막차 어림보다 늦어요
          </span>
        )}
        {plan.recent > 0 && <span className="text-meta text-muted">최근 30일 마이슐랭 평가 {plan.recent}곳</span>}
      </div>

      {pins.length > 0 && (
        <div className="relative -mx-5 h-[32dvh] min-h-52 overflow-hidden border-y border-line">
          <div className="absolute inset-0">
            <PlaceMap pins={pins} selectedId={selected} onSelect={(id) => setSelected(id)} padding={[36, 36, 36, 36]} />
          </div>
        </div>
      )}

      {plan.shops.length === 0 ? (
        <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-muted">
          이 지역엔 두 분 기록 · 팔로잉 평가 중 목적에 맞는 가게가 아직 없어요. 검색에서 가게를 찾아 저장해 보세요.
        </p>
      ) : (
        <div className="flex flex-col">
          {plan.shops.map((s) => (
            <PlaceRow
              key={s.placeId}
              id={`meet-${s.placeId}`}
              href={`/p/${s.placeId}`}
              selected={selected === s.placeId}
              name={s.name}
              cuisine={s.cuisine}
              tier={s.myTier}
              meta={[CUISINE_LABEL[s.cuisine], km(s.distance)].join(" · ")}
              note={s.reasons.filter((r) => !r.startsWith("내 ") && !r.startsWith("내가 ")).join(" · ") || undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
