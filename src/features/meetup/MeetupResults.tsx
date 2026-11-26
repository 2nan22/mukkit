"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { areaReason, nightClock } from "@/domain/meetup";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { AreaPlan } from "./meetup";
import { MetaLine } from "@/components/ui/MetaLine";

function km(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

const noSubscribe = (onChange: () => void) => {
  queueMicrotask(onChange);
  return () => undefined;
};

function who(p: { isMe: boolean; nickname: string }): string {
  return p.isMe ? "나" : `${p.nickname}님`;
}

function lateWarning(plan: AreaPlan): string | null {
  const late = plan.people.filter((p) => p.late);
  if (late.length === 0) return null;
  if (late.length === plan.people.length) return "헤어지는 시간이 모두의 막차보다 늦어요";
  return `헤어지는 시간이 ${late.map(who).join(", ")} 막차보다 늦어요`;
}

// 두 사람 모두 가기 편한 지역 3곳 · 지역마다 가게 — 고른 지역을 상대에게 보내기
// 추천 이유 — 내 등급은 배지로 이미 보이니 남의 평가만
function reasonLine(reasons: string[]) {
  const others = reasons.filter((r) => !r.startsWith("내 ") && !r.startsWith("내가 "));
  return others.length > 0 ? <MetaLine wrap className="text-meta text-ink-2" items={others} /> : undefined;
}

export function MeetupResults({ plans, meetupUrl, waitingCount }: { plans: AreaPlan[]; meetupUrl: string; waitingCount: number }) {
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
    return <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-muted">추천할 지역을 찾지 못했어요. 위치를 다른 역이나 동으로 바꿔 보세요.</p>;
  }

  async function sendArea() {
    const text = `${plan.name} 어때요? ${areaReason(plan.people)}`;
    if (canShare) return navigator.share({ title: "약속 장소", text, url: meetupUrl }).catch(() => undefined);
    try {
      await navigator.clipboard.writeText(`${text}\n${meetupUrl}`);
      setMessage("복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
    } catch {
      setMessage("복사하지 못했어요.");
    }
  }

  const warning = lateWarning(plan);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-section font-bold">{plan.people.length === 2 ? "두 사람 모두" : "모두"} 가기 편한 곳</h2>
        {waitingCount > 0 && <span className="text-meta text-muted">아직 위치를 안 넣은 {waitingCount}명은 빼고 계산했어요</span>}
      </div>
      <div role="tablist" aria-label="추천 지역" className="relative -mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
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
            {p.shops.length > 0 && <span className="ml-1.5 opacity-60">{p.shops.length}곳</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
        {active === 0 && <span className="w-fit rounded-full bg-white px-2 py-0.5 text-caption font-semibold text-brand">가장 공평한 곳</span>}
        <span className="text-body font-semibold">{areaReason(plan.people)}</span>
        <ul className="flex flex-col gap-0.5 text-meta text-ink-2">
          {plan.people.map((p) => (
            <li key={p.id} className={p.late ? "font-medium text-danger" : ""}>
              <MetaLine
                wrap
                className=""
                items={[`${who(p)} ${Math.round(p.minutes / 5) * 5}분쯤`, p.last ? `막차 늦어도 ${nightClock(p.last)}쯤 출발` : p.isMe ? "귀가지를 넣으면 막차도 알려 드려요" : null]}
              />
            </li>
          ))}
        </ul>
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
              meta={[CUISINE_LABEL[s.cuisine], km(s.distance)]}
              note={reasonLine(s.reasons)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
