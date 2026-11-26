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

// 받침 따라 '로' · '으로' — 받침이 없거나 ㄹ 이면 '로' (을지로로 · 명동으로)
function ro(word: string): string {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return "로";
  const jong = c % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}

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

  // 시간 차이가 거의 없으면(5분 이하) 사람별 줄을 숨긴다 — 요약 한 줄과 같은 말이 되풀이되지 않게 (79 디자인 검토)
  const mins = plan.people.map((p) => Math.round(p.minutes / 5) * 5);
  const even = Math.max(...mins) - Math.min(...mins) <= 5;
  const showMins = !even && plan.people.length > 2;
  const rows = plan.people.map((p, i) => ({ p, i })).filter(({ p }) => showMins || p.last);
  const meNoReturn = plan.people.some((p) => p.isMe && !p.last);
  const areaName = (name: string) => name.replace(/\//g, ", ");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-section font-bold tracking-[-0.01em]">{plan.people.length === 2 ? "두 사람 모두" : "모두"} 가기 편한 곳</h2>
        {waitingCount > 0 && <span className="text-meta text-muted">아직 위치를 안 넣은 {waitingCount}명은 빼고 계산했어요</span>}
      </div>
      {/* 순서: 지역 칩 › 지도 › 요약 › 가게 — 고르면 지도가 바로 바뀌어 보이게 (79) */}
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
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-meta font-semibold tracking-[-0.01em] ${i === active ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
          >
            {i === 0 && <span className={`text-caption font-bold ${i === active ? "text-[#ffb38a]" : "text-brand"}`}>추천</span>}
            {areaName(p.name)}
            {p.shops.length > 0 && <span className="font-medium opacity-60">{p.shops.length}곳</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="relative -mx-5 h-[28dvh] min-h-48 overflow-hidden">
          <div className="absolute inset-0">
            <PlaceMap pins={pins} selectedId={selected} onSelect={(id) => setSelected(id === "area" ? null : id)} padding={[36, 36, 36, 36]} />
          </div>
        </div>
        <span className="text-right text-caption text-subtle">거리로 계산한 예상 시간이에요</span>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[16px] bg-surface px-4 py-3.5">
        <span className="text-[16px] font-bold tracking-[-0.015em]">{even ? `모두 ${mins[0]}분쯤 걸려요` : areaReason(plan.people)}</span>
        {/* 제목이 이미 두 사람 시간을 말하니 줄마다 되풀이하지 않는다 — 사람별 줄은 막차 · 3명 이상 시간만 (83, 사용자 '가운데 그대로') */}
        {rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta text-ink-2">
            {rows.map(({ p, i }) => (
              <div key={p.id} className="contents">
                <dt className="text-muted">{who(p)}</dt>
                <dd>{[showMins ? `${mins[i]}분쯤` : null, p.last ? `막차 늦어도 ${nightClock(p.last)}쯤 출발` : null].filter(Boolean).join(", ")}</dd>
              </div>
            ))}
          </dl>
        )}
        {warning && <span className="text-meta font-medium text-danger">{warning}</span>}
        {plan.recent >= 20 && <span className="text-meta text-muted">요즘 평가가 많은 동네예요</span>}
        {meNoReturn && <span className="text-meta text-muted">귀가지를 넣으면 막차도 알려 드려요</span>}
      </div>

      {plan.shops.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[16px] bg-surface p-5 text-center">
          <span className="text-meta leading-normal text-muted">아직 평가된 가게가 없어요</span>
          <Link href={`/search?q=${encodeURIComponent(areaName(plan.name).split(",")[0])}`} className="flex h-10 items-center rounded-[12px] bg-white px-4 text-meta font-semibold text-ink raised-soft">
            {areaName(plan.name).split(",")[0]} 가게 찾기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between gap-2 pb-1">
            <h3 className="text-body font-bold tracking-[-0.01em]">
              {areaName(plan.name)} 가게 {plan.shops.length}곳
            </h3>
            <span className="text-meta text-muted">같이 가는 분들 평가 순</span>
          </div>
          {plan.shops.map((s) => (
            <PlaceRow
              key={s.placeId}
              id={`meet-${s.placeId}`}
              href={`/p/${s.placeId}`}
              selected={selected === s.placeId}
              name={s.name}
              cuisine={s.cuisine}
              tier={s.myTier}
              meta={[CUISINE_LABEL[s.cuisine], `${areaName(plan.name).split(",")[0]}에서 ${km(s.distance)}`]}
              note={reasonLine(s.reasons)}
            />
          ))}
        </div>
      )}

      {/* 제안하기는 아래 고정 — 목록을 보다가도 바로 (토스 정산처럼, 79) */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[480px] flex-col gap-1.5 border-t border-line bg-white px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        {message && (
          <p role="status" className="text-center text-meta text-ink-2">
            {message}
          </p>
        )}
        <button type="button" onClick={sendArea} className="h-btn-m w-full rounded-btn-m bg-brand text-body font-bold text-white raised-brand">
          {areaName(plan.name).split(",")[0]}
          {ro(areaName(plan.name).split(",")[0])} 제안하기
        </button>
      </div>
    </section>
  );
}
