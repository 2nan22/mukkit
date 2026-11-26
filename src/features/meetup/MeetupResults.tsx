"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { areaReason, isEven, lastTrainLine, timeHeadline, type RankedPerson } from "@/domain/meetup";
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

// 두 사람 모두 가기 편한 지역 3곳 · 지역마다 가게 — 고른 지역을 상대에게 보내기
// 추천 이유 — 내 등급은 배지로 이미 보이니 남의 평가만
function reasonLine(reasons: string[]) {
  const others = reasons.filter((r) => !r.startsWith("내 ") && !r.startsWith("내가 "));
  return others.length > 0 ? <MetaLine wrap className="text-meta text-ink-2" items={others} /> : undefined;
}

export function MeetupResults({ plans, meetupUrl, waitingCount, endsAt = null }: { plans: AreaPlan[]; meetupUrl: string; waitingCount: number; endsAt?: string | null }) {
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

  const even = isEven(plan.people);
  const areaName = (name: string) => name.replace(/\//g, ", ");
  const head = areaName(plan.name).split(",")[0];

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

      <div className="relative -mx-5 h-[28dvh] min-h-48 overflow-hidden">
        <div className="absolute inset-0">
          <PlaceMap pins={pins} selectedId={selected} onSelect={(id) => setSelected(id === "area" ? null : id)} padding={[36, 36, 36, 36]} />
        </div>
      </div>

      {/* 시간 카드 — 제목은 결론, 숫자는 막대, 빨강은 막차가 끊길 때 한 줄만 (83 디자인 검토) */}
      <div className="flex flex-col gap-3 rounded-[16px] bg-surface p-4">
        <span className="text-[16px] font-bold tracking-[-0.015em] text-ink">{timeHeadline(plan.people)}</span>
        {!even && <TimeBars people={plan.people} />}
        <LastTrain people={plan.people} endsAt={endsAt} />
        <span className="text-caption text-subtle">직선거리로 어림한 시간이라 실제와 다를 수 있어요</span>
      </div>

      {plan.shops.length === 0 ? (
        // 빈 상태는 상자 없이 목록 자리에 (83) · 다른 지역 가게 링크는 뺌 — 만나는 곳이 바뀌는 줄 몰라 헷갈림 (83-2, 사용자), 지역은 위 칩에서
        <div className="mt-2 flex flex-col gap-1">
          <h3 className="text-body font-bold tracking-[-0.01em]">{head} 가게</h3>
          <p className="text-meta text-muted">같이 가는 분들이 평가한 곳이 아직 없어요</p>
          <div className="flex flex-wrap gap-x-4 text-meta font-semibold text-ink">
            <Link href={`/search?q=${encodeURIComponent(head)}`} className="flex h-11 items-center gap-0.5">
              {head}에서 찾아보기
              <Chevron />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-body font-bold tracking-[-0.01em]">
              {areaName(plan.name)} 가게 {plan.shops.length}곳
            </h3>
            <span className="text-meta text-muted">같이 가는 분들 평가 순</span>
          </div>
          {plan.recent >= 20 && <span className="text-meta text-muted">요즘 평가가 많은 동네예요</span>}
          <span className="pb-1" />
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
          {head}
          {ro(head)} 제안하기
        </button>
      </div>
    </section>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// 사람별 막대 — 나 먼저, 그다음 오래 걸리는 순. 상대는 분만(동네 이름 없음)
function TimeBars({ people }: { people: RankedPerson[] }) {
  const max = Math.max(...people.map((p) => p.minutes));
  const sorted = [...people].sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.minutes - a.minutes);
  return (
    // 한 격자에 모든 줄 — 이름 칸 너비를 가장 긴 이름에 맞춰 막대 시작이 같게 (긴 별명은 7rem 에서 말줄임)
    <div className="grid grid-cols-[minmax(0,max-content)_1fr_auto] items-center gap-x-3 gap-y-2">
      {sorted.map((p) => (
        <Fragment key={p.id}>
          <span className={`max-w-[7rem] truncate text-meta ${p.isMe ? "font-semibold text-ink" : "text-ink-2"}`}>{who(p)}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white">
            <span className={`block h-full rounded-full ${p.isMe ? "bg-me" : "bg-subtle"}`} style={{ width: `${Math.max(8, (p.minutes / max) * 100)}%` }} />
          </span>
          <span className="text-right text-meta font-semibold text-ink tabular-nums">{Math.round(p.minutes / 5) * 5}분</span>
        </Fragment>
      ))}
    </div>
  );
}

// 막차 줄 — 문구는 domain/meetup lastTrainLine 이 고른다 (끊기면 빨강 한 줄 + 근거, 낮 약속엔 없음)
function LastTrain({ people, endsAt }: { people: RankedPerson[]; endsAt: string | null }) {
  const line = lastTrainLine(people, endsAt ? new Date(endsAt) : null);
  if (!line) return null;
  return (
    <>
      <span aria-hidden="true" className="h-px bg-line-strong" />
      <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1 text-meta">
        <span className="text-muted">막차</span>
        {line.title && line.late ? (
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold text-danger">{line.title}</span>
            <span className="text-ink-2">{line.detail}</span>
          </span>
        ) : line.title ? (
          <span className="text-ink-2">
            {line.title} <span className="text-muted">{line.detail}</span>
          </span>
        ) : null}
        {line.askMine && (
          <>
            {line.title && <span />}
            <span className="flex items-center justify-between gap-3">
              <span className="text-muted">{line.title ? "귀가지를 넣으면 내 막차도 알려 드려요" : "귀가지를 넣으면 알려 드려요"}</span>
              <button type="button" onClick={openReturnPoint} className="-my-3 h-11 shrink-0 font-semibold text-ink">
                귀가지 넣기
              </button>
            </span>
          </>
        )}
      </div>
    </>
  );
}

// 아래 '내 위치'를 펼치고 귀가지 칸으로 — 고정 버튼에 가리지 않게 위쪽에 맞추고 넣기 버튼에 포커스
function openReturnPoint() {
  const box = document.getElementById("my-points");
  if (box instanceof HTMLDetailsElement) box.open = true;
  requestAnimationFrame(() => {
    const point = document.getElementById("point-return");
    point?.scrollIntoView({ behavior: "smooth", block: "start" });
    point?.querySelector<HTMLButtonElement>("button[data-edit]")?.focus({ preventScroll: true });
  });
}
