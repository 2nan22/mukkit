"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { areaReason, isEven, lastTrainLine, timeHeadline, type RankedPerson } from "@/domain/meetup";
import { PlaceMap, type Pin } from "@/features/map/PlaceMap";
import { metersBetween } from "@/domain/listSort";
import type { AreaPlan, MeetPoint } from "./meetup";
import { MeetPointCard, type MeetOption } from "./MeetPointCard";
import { COURSE_MAX, meetLeg, straightRoute } from "@/domain/course";
import { useCourseDraft } from "./useCourseDraft";
import type { Course, CourseStop } from "./course";
import { CourseCard } from "./CourseCard";
import { courseShareText, useCourseLayers } from "./CourseMap";
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

export function MeetupResults({
  plans,
  meetupUrl,
  waitingCount,
  endsAt = null,
  meetupId,
  course,
  meet = null,
  before = null,
  editable = true,
}: {
  // 끝난 약속이면 코스 · 만날 곳을 못 고침
  editable?: boolean;
  // 위쪽 내 위치 줄 — 코스 · 만날 곳 앞에 (89)
  before?: React.ReactNode;
  plans: AreaPlan[];
  meetupUrl: string;
  waitingCount: number;
  endsAt?: string | null;
  meetupId: string;
  course: Course;
  meet?: MeetPoint | null;
}) {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const plan = plans[active];
  const router = useRouter();
  // 대중교통 시간은 화면을 그린 뒤 서버가 잰다 — 아직 어림인 사람이 있으면 6 · 15 · 30초에 다시 불러온다(최대 3번, 86)
  const allExact = plan ? plan.people.every((p) => p.exact) : true;
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (allExact || tries >= 3) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, [6000, 15000, 30000][tries]);
    return () => clearTimeout(t);
  }, [allExact, tries, router]);
  // 코스 (84) — 담은 순서 그대로. 누르면 바로 바꿔 보이고 모아서 저장
  const draft = useCourseDraft(meetupId, course.stops.map((s) => s.placeId));
  const courseIds = draft.ids;
  // 지도 하나 (89) — 고른 지역 가게 핀 + 코스 번호 핀 · 만날 곳 깃발 · 길. 담는 중엔 직선 어림
  const allShops = useMemo(() => plans.flatMap((p) => p.shops), [plans]);
  const draftStops = useMemo<CourseStop[]>(
    () =>
      courseIds.flatMap((id) => {
        const c = course.stops.find((x) => x.placeId === id);
        if (c) return [c];
        const s = allShops.find((x) => x.placeId === id);
        return s ? [{ placeId: id, name: s.name, cuisine: s.cuisine, address: "", lat: s.lat, lng: s.lng }] : [];
      }),
    [courseIds, course.stops, allShops],
  );
  const synced = draft.synced;
  const draftRoute = useMemo(() => (synced ? course.route : draftStops.length >= 2 ? straightRoute(draftStops) : null), [synced, course.route, draftStops]);
  const layers = useCourseLayers(draftStops, draftRoute, meet, synced ? course.meetWalk : null);
  // 평가 안 한 가게는 중립 핀, 가게가 없으면 지역 가운데만 · 코스에 담은 곳은 코스 층의 번호 핀
  const areaPins = useMemo<Pin[]>(
    () =>
      plan?.shops.length
        ? plan.shops.filter((s) => !courseIds.includes(s.placeId)).map((s) => ({ id: s.placeId, lat: s.lat, lng: s.lng, tier: s.myTier ?? "unrated" }))
        : plan && plan.people.length > 0
          ? [{ id: "area", lat: plan.lat, lng: plan.lng, tier: "wantToGo" as const }]
          : [],
    [plan, courseIds],
  );
  // 코스가 없을 땐 만날 곳 깃발을 지금 보는 지역의 만날 곳일 때만 (다른 지역이면 지도가 멀리 넓어짐, 88-2)
  const loneMeet = useMemo<Pin[]>(() => {
    if (draftStops.length > 0 || !meet || !plan) return [];
    const here = meet.area === plan.name || (!meet.area && metersBetween(meet, plan) < 3000);
    return here ? [{ id: "meet", lat: meet.lat, lng: meet.lng, tier: "unrated", kind: "meet", label: meet.label }] : [];
  }, [draftStops.length, meet, plan]);
  const pins = useMemo(() => [...areaPins, ...layers.pins, ...loneMeet], [areaPins, layers.pins, loneMeet]);
  // 코스가 있는 지역 — 만날 곳(없으면 1차)에서 가장 가까운 추천 지역. 다른 지역을 보면 지도는 그 지역 가게에만 맞춘다
  const anchor = meet ?? draftStops[0] ?? null;
  const courseArea = useMemo(() => {
    if (!anchor || draftStops.length === 0) return -1;
    let best = 0;
    plans.forEach((p, i) => {
      if (metersBetween(anchor, p) < metersBetween(anchor, plans[best])) best = i;
    });
    // 어느 지역과도 3km 넘게 떨어졌으면 '코스 지역' 없음 — 먼 칩을 코스라 부르지 않게 (91 검토)
    return plans[best] && metersBetween(anchor, plans[best]) <= 3000 ? best : -1;
  }, [anchor, draftStops.length, plans]);
  const awayFromCourse = courseArea >= 0 && courseArea !== active;
  const fitPins = useMemo(() => (awayFromCourse ? areaPins : null), [awayFromCourse, areaPins]);
  // 만날 곳 바꾸기 시트 — 코스 카드 만날 곳 줄에서도 연다
  const [meetOpen, setMeetOpen] = useState(false);

  function toggleCourse(placeId: string) {
    const adding = !courseIds.includes(placeId);
    const next = adding ? [...courseIds, placeId] : courseIds.filter((id) => id !== placeId);
    if (next.length > COURSE_MAX) return setMessage(`코스는 ${COURSE_MAX}곳까지 담을 수 있어요`);
    draft.change(next);
    setMessage(adding ? `${next.length}차로 담았어요. 순서는 위 코스에서 바꿀 수 있어요` : null);
  }

  if (plans.length === 0) {
    return <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-muted">추천할 지역을 찾지 못했어요. 위치를 다른 역이나 동으로 바꿔 보세요.</p>;
  }

  async function sendArea() {
    const where = meet ? `${meet.label}에서 만나요` : null;
    const text = [where, courseIds.length > 0 ? courseShareText(courseNames) : where ? null : `${plan.name} 어때요? ${areaReason(plan.people)}`].filter(Boolean).join("\n");
    if (canShare) return navigator.share({ title: "약속 장소", text, url: meetupUrl }).catch(() => undefined);
    try {
      await navigator.clipboard.writeText(`${text}\n${meetupUrl}`);
      setMessage("복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
    } catch {
      setMessage("복사하지 못했어요.");
    }
  }

  const even = isEven(plan.people);
  // 만날 곳 근처 칩 (91) — 사람별 시간이 없음(people 빈 배열). 그 칩뿐이면(출발지가 모이기 전) 지역 칩 · 시간 카드 없이 가게만
  const solo = plan.people.length === 0;
  const onlyMeet = plans.every((p) => p.people.length === 0);
  // 담은 곳 이름 — 지금 지역 가게 목록에 없으면(다른 지역에서 담음) 서버 코스에서
  const nameOf = (id: string) => plans.flatMap((p) => p.shops).find((s) => s.placeId === id)?.name ?? course.stops.find((s) => s.placeId === id)?.name ?? "";
  const courseNames = courseIds.map((id) => ({ name: nameOf(id) }));

  const areaName = (name: string) => name.replace(/\//g, ", ");
  const head = areaName(plan.name).split(",")[0];

  // 만날 곳 고르기 — 추천 지역 대표 역들 · 코스 1차 가게 (86)
  const stationOf = (p: AreaPlan): MeetOption => ({ key: `a${p.name}`, label: p.station ?? areaName(p.name), sub: `추천 지역 ${areaName(p.name)}`, lat: p.lat, lng: p.lng, area: p.name });
  const firstStop = course.stops[0];
  const meetOptions: MeetOption[] = [
    // 만날 곳 근처만 볼 때(91)는 그 칩이 내가 고른 곳이라 '추천 지역'으로 다시 권하지 않음
    ...(plan.people.length === 0 ? [] : plans.map(stationOf)),
    ...(firstStop ? [{ key: `c${firstStop.placeId}`, label: firstStop.name, sub: "코스 1차 가게에서 바로", lat: firstStop.lat, lng: firstStop.lng, area: null }] : []),
  ];

  // 코스 카드가 만날 곳 줄을 보여 주면 만날 곳 카드는 숨기고 시트만 (89) — 1차에서 바로 만나면 카드 그대로
  const meetInCourse = Boolean(meet && course.stops.length > 0 && meetLeg(meet, course.stops[0], null)?.atFirst === false);
  const meetCard = (hidden: boolean) => (
    <MeetPointCard
      meetupId={meetupId}
      meet={meet}
      viewing={!hidden && meet?.area && meet.area !== plan.name ? stationOf(plan) : null}
      suggested={stationOf(plan)}
      options={meetOptions}
      cardHidden={hidden}
      open={meetOpen}
      onOpenChange={setMeetOpen}
      onPickArea={(area) => {
        const i = plans.findIndex((p) => p.name === area);
        if (i >= 0) {
          setActive(i);
          setSelected(null);
        }
      }}
    />
  );

  return (
    <section className="flex flex-col gap-4">
      {before}
      {meetInCourse ? (
        <>
          <CourseCard meetupId={meetupId} course={course} editable={editable} meet={meet} onChangeMeet={() => setMeetOpen(true)} />
          {meetCard(true)}
        </>
      ) : (
        <>
          {meetCard(false)}
          {course.stops.length > 0 && <CourseCard meetupId={meetupId} course={course} editable={editable} meet={meet} />}
        </>
      )}
      {!onlyMeet && (<>
      <div className="flex flex-col gap-0.5 pt-3">
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
            {/* 코스가 있는 지역은 '코스', 아니면 첫 지역 '추천' — 지도 · 코스 카드가 어느 지역 것인지 칩에서 보이게 (89) */}
            {(i === courseArea || (courseArea < 0 && i === 0)) && (
              <span className={`text-caption font-bold ${i === active ? "text-white" : "text-ink"}`}>{i === courseArea ? "코스" : "추천"}</span>
            )}
            {areaName(p.name)}
            {p.shops.length > 0 && <span className="font-medium opacity-60">{p.shops.length}곳</span>}
          </button>
        ))}
      </div>

      {/* 시간 카드 — 제목은 결론, 숫자는 막대, 빨강은 막차가 끊길 때 한 줄만 (83 디자인 검토) */}
      {solo ? (
        <p className="text-meta text-muted">먼저 정한 만날 곳 근처예요. 걸리는 시간은 다른 칩에서 볼 수 있어요</p>
      ) : (
      <div className="flex flex-col gap-3 rounded-[16px] bg-surface p-4">
        <span className="text-[16px] font-bold tracking-[-0.015em] text-ink">{timeHeadline(plan.people)}</span>
        {!even && <TimeBars people={plan.people} />}
        <LastTrain people={plan.people} endsAt={endsAt} />
        <span className="text-caption text-subtle">{allExact ? "지하철, 버스 기준이에요. 막차는 어림이에요" : "일부는 거리로 어림한 시간이라 실제와 다를 수 있어요"}</span>
      </div>
      )}
      </>)}

      {/* 지도 하나 — 가게 목록 바로 위, 내리면 위에 붙어 따라온다 (89) */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-5 h-[26dvh] min-h-44 overflow-hidden border-b border-line bg-map-land">
        <div className="absolute inset-0">
          <PlaceMap
            pins={pins}
            route={layers.line}
            approach={layers.approach}
            fitPins={fitPins}
            selectedId={selected}
            onSelect={(id) => setSelected(id === "area" || id === "meet" ? null : id)}
            padding={[36, 36, 36, 36]}
          />
        </div>
        {awayFromCourse && (
          <button
            type="button"
            onClick={() => {
              setActive(courseArea);
              setSelected(null);
            }}
            className="absolute bottom-2.5 left-3 z-10 flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-meta font-semibold text-ink shadow-[0_1px_6px_rgba(0,0,0,0.18)]"
          >
            <span className="text-muted">{head} 가게를 보는 중</span>
            <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
            코스로 돌아가기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {plan.shops.length === 0 ? (
        // 빈 상태는 상자 없이 목록 자리에 (83) · 다른 지역 가게 링크는 뺌 — 만나는 곳이 바뀌는 줄 몰라 헷갈림 (83-2, 사용자), 지역은 위 칩에서
        <div className="mt-2 flex flex-col gap-1">
          <h3 className="text-body font-bold tracking-[-0.01em]">{solo ? "만날 곳 근처 가게" : `${head} 가게`}</h3>
          <p className="text-meta text-muted">{solo ? "근처에 평가한 곳이 아직 없어요" : "같이 가는 분들이 평가한 곳이 아직 없어요"}</p>
          {(!solo || meet?.area) && (
            <div className="flex flex-wrap gap-x-4 text-meta font-semibold text-ink">
              <Link href={`/search?q=${encodeURIComponent(solo ? meet!.area! : head)}`} className="flex h-11 items-center gap-0.5">
                {solo ? meet!.area : head}에서 찾아보기
                <Chevron />
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-body font-bold tracking-[-0.01em]">
              {solo ? "만날 곳 근처 가게" : `${areaName(plan.name)} 가게`} {plan.shops.length}곳
            </h3>
            <span className="text-meta text-muted">{solo ? "평가 순" : "같이 가는 분들 평가 순"}</span>
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
              meta={[CUISINE_LABEL[s.cuisine], `${solo ? "만날 곳" : areaName(plan.name).split(",")[0]}에서 ${km(s.distance)}`]}
              note={reasonLine(s.reasons)}
              action={<CourseToggle order={courseIds.indexOf(s.placeId)} name={s.name} onClick={() => toggleCourse(s.placeId)} />}
            />
          ))}
        </div>
      )}

      {/* 제안하기는 아래 고정 — 목록을 보다가도 바로 (토스 정산처럼, 79) */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[480px] flex-col gap-1.5 border-t border-line bg-white px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        {(draft.error ?? message) && (
          <p role="status" className="text-center text-meta text-ink-2">
            {draft.error ?? message}
          </p>
        )}
        <button type="button" onClick={sendArea} className="h-btn-m w-full rounded-btn-m bg-brand text-body font-bold text-white raised-brand">
          {courseIds.length > 0 ? "이 코스로 제안하기" : meet ? "만날 곳으로 제안하기" : `${head}${ro(head)} 제안하기`}
        </button>
      </div>
    </section>
  );
}

// 가게 줄 오른쪽 — 담기 전 '+' 테두리 원, 담으면 검정 원 안 번호 (주황은 주 버튼 하나만, 84 검토)
function CourseToggle({ order, name, onClick }: { order: number; name: string; onClick: () => void }) {
  const on = order >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? `${name} 코스 ${order + 1}차, 누르면 빼기` : `${name} 코스에 담기`}
      className="flex size-11 shrink-0 items-center justify-center"
    >
      {on ? (
        <span className="flex size-8 items-center justify-center rounded-full bg-ink text-meta font-bold text-white">{order + 1}</span>
      ) : (
        <span className="flex size-8 items-center justify-center rounded-full border border-line-strong text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      )}
    </button>
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

// 위 '내 위치'를 펼치고 귀가지 칸으로 — 고정 버튼에 가리지 않게 위쪽에 맞추고 넣기 버튼에 포커스
function openReturnPoint() {
  const box = document.getElementById("my-points");
  if (box instanceof HTMLDetailsElement) box.open = true;
  requestAnimationFrame(() => {
    const point = document.getElementById("point-return");
    point?.scrollIntoView({ behavior: "smooth", block: "start" });
    point?.querySelector<HTMLButtonElement>("button[data-edit]")?.focus({ preventScroll: true });
  });
}
