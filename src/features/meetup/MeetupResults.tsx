"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { areaReason, nightClock } from "@/domain/meetup";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { AreaPlan } from "./meetup";

function km(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

const noSubscribe = (onChange: () => void) => {
  queueMicrotask(onChange);
  return () => undefined;
};

function lateWarning(plan: AreaPlan, nickname: string): string | null {
  if (plan.myLate && plan.partnerLate) return "헤어지는 시간이 두 사람 모두의 막차보다 늦어요";
  if (plan.myLate) return "헤어지는 시간이 내 막차보다 늦어요";
  if (plan.partnerLate) return `헤어지는 시간이 ${nickname}님 막차보다 늦어요`;
  return null;
}

// 두 사람 모두 가기 편한 지역 3곳 · 지역마다 가게 — 고른 지역을 상대에게 보내기
export function MeetupResults({ plans, partnerNickname, meetupUrl }: { plans: AreaPlan[]; partnerNickname: string; meetupUrl: string }) {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const plan = plans[active];
  // 평가 안 한 가게는 중립 핀, 가게가 없으면 지역 가운데만
  const pins = useMemo(
    () => (plan?.shops.length ? plan.shops.map((s) => ({ id: s.placeId, lat: s.lat, lng: s.lng, tier: s.myTier ?? "unrated" })) : plan ? [{ id: "area", lat: plan.lat, lng: plan.lng, tier: "wantToGo" as const }] : []),
    [plan],
  );

  if (plans.length === 0) {
    return <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-muted">두 사람 사이에서 추천할 지역을 찾지 못했어요. 위치를 다른 역이나 동으로 바꿔 보세요.</p>;
  }

  async function sendArea() {
    const text = `${plan.name} 어때요? ${areaReason(plan.myMinutes, plan.partnerMinutes, partnerNickname)}`;
    if (canShare) return navigator.share({ title: "약속 장소", text, url: meetupUrl }).catch(() => undefined);
    try {
      await navigator.clipboard.writeText(`${text}\n${meetupUrl}`);
      setMessage("복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
    } catch {
      setMessage("복사하지 못했어요.");
    }
  }

  const warning = lateWarning(plan, partnerNickname);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-section font-bold">두 사람 모두 가기 편한 곳</h2>
      <div role="tablist" aria-label="추천 지역" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {plans.map((p, i) => (
          <button
            key={p.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => {
              setActive(i);
              setSelected(null);
              setMessage(null);
            }}
            className={`h-9 shrink-0 rounded-full px-3.5 text-meta font-medium ${i === active ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
          >
            {p.name}
            {p.shops.length > 0 && <span className="opacity-60"> · {p.shops.length}곳</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
        {active === 0 && <span className="w-fit rounded-full bg-white px-2 py-0.5 text-caption font-semibold text-brand">가장 공평한 곳</span>}
        <span className="text-body font-semibold">{areaReason(plan.myMinutes, plan.partnerMinutes, partnerNickname)}</span>
        <span className="flex flex-col gap-0.5 text-meta text-ink-2">
          <span>{plan.myLast ? `내 막차: 늦어도 ${nightClock(plan.myLast)}쯤 여기서 출발` : "내 귀가지를 넣으면 막차도 알려 드려요"}</span>
          <span>{plan.partnerLast ? `${partnerNickname}님 막차: 늦어도 ${nightClock(plan.partnerLast)}쯤 출발` : `${partnerNickname}님은 귀가지를 넣지 않았어요`}</span>
        </span>
        {warning && <span className="text-meta font-medium text-danger">{warning}</span>}
        {plan.recent > 0 && <span className="text-meta text-muted">최근 한 달 새 평가된 가게 {plan.recent}곳</span>}
        <button type="button" onClick={sendArea} className="mt-1 h-btn-m rounded-btn-m bg-brand text-body font-bold text-white raised-brand">
          {plan.name} 제안하기
        </button>
        {message && (
          <p role="status" className="text-meta text-ink-2">
            {message}
          </p>
        )}
        <span className="text-[12px] text-subtle">이동 시간과 막차는 거리로 계산한 예상값이라 실제와 다를 수 있어요.</span>
      </div>

      <div className="relative -mx-5 h-[32dvh] min-h-52 overflow-hidden border-y border-line">
        <div className="absolute inset-0">
          <PlaceMap pins={pins} selectedId={selected} onSelect={(id) => setSelected(id === "area" ? null : id)} padding={[36, 36, 36, 36]} />
        </div>
      </div>

      {plan.shops.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[16px] bg-surface p-5 text-center">
          <span className="text-meta leading-normal text-muted">이 지역엔 두 사람이나 팔로우한 분이 평가한 가게가 아직 없어요.</span>
          <Link href="/search" className="flex h-10 items-center rounded-[12px] bg-white px-4 text-meta font-semibold text-ink raised-soft">
            이 근처 가게 찾기
          </Link>
        </div>
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
