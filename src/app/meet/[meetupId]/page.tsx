import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { PURPOSE_LABEL } from "@/domain/meetup";
import { meetWhen } from "@/domain/meetTime";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { CloseMeetup } from "@/features/meetup/CloseMeetup";
import { InviteAnswer } from "@/features/meetup/InviteAnswer";
import { getMeetPoint, getMeetupStatus, getMyPoints, planAroundMeet, planMeetup, type MeetupMember } from "@/features/meetup/meetup";
import { refreshMeetupTransit } from "@/features/meetup/transit";
import { after } from "next/server";
import { MeetupRefresher } from "@/features/meetup/MeetupRefresher";
import { MeetupResults } from "@/features/meetup/MeetupResults";
import { MeetPointCard } from "@/features/meetup/MeetPointCard";
import { metersBetween } from "@/domain/listSort";
import { CourseCard } from "@/features/meetup/CourseCard";
import { getCourse } from "@/features/meetup/course";
import { refreshCourseRoute } from "@/features/meetup/courseRoute";
import { PointEditor } from "@/features/meetup/PointEditor";
import { PushToggle } from "@/features/push/PushToggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약속" };

// 사람마다 상태 (67) — 출발지 넣음 · 출발지 전 · 수락 기다리는 중 (위치 값은 보이지 않음)
function Members({ members, invitees }: { members: MeetupMember[]; invitees: { id: string; nickname: string }[] }) {
  const ready = members.filter((m) => m.ready).length;
  const allReady = invitees.length === 0 && ready === members.length;
  return (
    <section className="flex flex-col gap-1">
      {!allReady && (
        <div className="flex items-baseline justify-between">
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">함께하는 사람</h3>
          <span className="text-meta text-muted">출발지 넣은 사람 {ready}명</span>
        </div>
      )}
      {/* 모두 출발지를 넣었으면 한 줄로 접는다 — 새로 알려 줄 게 없어서 (79 디자인 검토) */}
      {allReady ? (
        <details className="group">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2">
            <span className="flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-white">
                  <Avatar name={m.nickname} size={24} />
                </span>
              ))}
            </span>
            <span className="flex-1 text-meta text-ink-2">{members.length}명 모두 출발지를 넣었어요</span>
            <span className="text-meta text-muted group-open:hidden">보기</span>
          </summary>
        <ul className="flex flex-col">
          {members.map((m) => (
            <li key={m.id} className="flex min-h-12 items-center gap-3 border-b border-line last:border-b-0">
              <Avatar name={m.nickname} size={32} />
              <span className="flex-1 truncate text-body">{m.isMe ? `${m.nickname} (나)` : m.nickname}</span>
              <span className={`shrink-0 text-meta ${m.ready ? "font-semibold text-[#1f7a4d]" : "text-muted"}`}>{m.ready ? "출발지 넣음" : "출발지 아직"}</span>
            </li>
          ))}
          {invitees.map((i) => (
            <li key={i.id} className="flex min-h-12 items-center gap-3 border-b border-line last:border-b-0">
              <Avatar name={i.nickname} size={32} />
              <span className="flex-1 truncate text-body text-ink-2">{i.nickname}</span>
              <span className="shrink-0 text-meta text-muted">수락 기다리는 중</span>
            </li>
          ))}
        </ul>
        </details>
      ) : (
        <ul className="flex flex-col">
          {members.map((m) => (
            <li key={m.id} className="flex min-h-12 items-center gap-3 border-b border-line last:border-b-0">
              <Avatar name={m.nickname} size={32} />
              <span className="flex-1 truncate text-body">{m.isMe ? `${m.nickname} (나)` : m.nickname}</span>
              <span className={`shrink-0 text-meta ${m.ready ? "font-semibold text-[#1f7a4d]" : "text-muted"}`}>{m.ready ? "출발지 넣음" : "출발지 아직"}</span>
            </li>
          ))}
          {invitees.map((i) => (
            <li key={i.id} className="flex min-h-12 items-center gap-3 border-b border-line last:border-b-0">
              <Avatar name={i.nickname} size={32} />
              <span className="flex-1 truncate text-body text-ink-2">{i.nickname}</span>
              <span className="shrink-0 text-meta text-muted">수락 기다리는 중</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MeetPage({ params }: PageProps<"/meet/[meetupId]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/meet" title="약속" />
      <Suspense fallback={<ListSkeleton />}>
        <Meet params={params} />
      </Suspense>
    </main>
  );
}

async function Meet({ params }: { params: Promise<{ meetupId: string }> }) {
  const { meetupId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(meetupId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const status = await getMeetupStatus(supabase, meetupId);
  // 취소돼 지워졌거나 나간 약속 — 예전 알림 · 푸시 링크로 들어와도 빈 404 대신 (90-2)
  if (!status) {
    return (
      <section className="flex flex-col gap-2 px-5 pt-6 pb-10">
        <h2 className="text-title font-bold tracking-[-0.02em]">열 수 없는 약속이에요</h2>
        <p className="text-body leading-relaxed text-ink-2">취소됐거나 내가 나간 약속이에요.</p>
        <Link href="/meet" className="flex h-11 items-center self-start text-meta font-semibold text-ink underline underline-offset-[3px]">
          약속 목록 보기
        </Link>
      </section>
    );
  }
  const purpose = PURPOSE_LABEL[status.purpose];

  if (!status.isMember && status.isInvitee) {
    return (
      <div className="flex flex-col gap-6 px-5 pb-10">
        <InviteAnswer meetupId={status.id} hostNickname={status.hostNickname} purposeLabel={purpose} when={meetWhen(status.startsAt, status.endsAt)} />
      </div>
    );
  }

  const points = await getMyPoints(supabase, meetupId);
  const label = (k: "origin" | "return") => points.find((p) => p.kind === k)?.label ?? null;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const readyCount = status.members.filter((m) => m.ready).length;
  const others = status.members.filter((m) => !m.isMe);
  const ready = status.meReady && readyCount >= 2;
  const [ranked, course, meet] = await Promise.all([ready ? planMeetup(supabase, me, status) : Promise.resolve([]), getCourse(supabase, meetupId), getMeetPoint(supabase, meetupId)]);
  // 출발지가 모이기 전이라도 만날 곳을 정했으면 그 근처 가게로 (91)
  const aroundMeet = !ready && meet && status.status === "open" ? await planAroundMeet(supabase, me, status, meet) : null;
  // 출발지가 모인 뒤에도, 먼저 정한 만날 곳이 추천 지역들과 멀면(1.5km 넘게) 그 동네를 첫 칩으로 남긴다 (91 검토)
  const meetFar = ready && meet && ranked.length > 0 && ranked.every((a) => metersBetween(meet, a) > 1500);
  const plans = aroundMeet ? [aroundMeet] : meetFar ? [await planAroundMeet(supabase, me, status, meet), ...ranked] : ranked;
  // 아직 안 잰 대중교통 구간만 화면을 그린 뒤 잰다 — 하루 상한 안에서 (86)
  if (ready && status.status === "open" && plans.some((p) => p.people.some((x) => !x.exact))) after(() => refreshMeetupTransit(meetupId, plans.map((p) => p.name)).catch(() => 0));
  // 코스 길을 아직 못 받았거나 옛것이면(만날 곳을 바꿈 · 실패 뒤) 화면을 그린 뒤 받는다
  if (status.status === "open" && course.stale) after(() => refreshCourseRoute(meetupId).catch(() => false));
  const title = others.length === 0 ? `${purpose} 약속` : others.length === 1 ? `${others[0].nickname}님과 ${purpose}` : `${others.length + 1}명 ${purpose}`;
  const canInvite = status.isHost && status.status === "open" && status.members.length < status.maxMembers;

  const editors = (
    <>
      <PointEditor meetupId={status.id} kind="origin" current={label("origin")} />
      <PointEditor meetupId={status.id} kind="return" current={label("return")} />
    </>
  );
  // 친구 초대는 따로 화면 — 만든 직후와 같은 화면 (67)
  const invite = canInvite && (
    <Link href={`/meet/${status.id}/invite`} className="flex min-h-12 items-center justify-between rounded-[12px] border border-line px-4 text-body">
      친구 더 초대하기
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );

  // 내 위치 — 출발 · 귀가 한 줄씩(한 줄에 둘이면 귀가가 잘림, 83) · 시간 카드 '귀가지 넣기'가 id 로 펼친다
  const myPoints = (
    <details id="my-points" className="group scroll-mt-20 rounded-[16px] bg-surface">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 text-meta">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-caption text-muted">내 위치</span>
          <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 group-open:hidden">
            <dt className="text-muted">출발</dt>
            <dd className="truncate text-ink-2">{label("origin") ?? <span className="text-subtle">안 넣었어요</span>}</dd>
            <dt className="text-muted">귀가</dt>
            <dd className="truncate text-ink-2">{label("return") ?? <span className="text-subtle">안 넣었어요</span>}</dd>
          </dl>
        </span>
        <span className="flex h-11 shrink-0 items-center font-semibold text-ink group-open:hidden">바꾸기</span>
      </summary>
      <div className="flex flex-col gap-2 px-2 pb-2">{editors}</div>
    </details>
  );

  return (
    // 추천이 나오면 아래에 제안하기가 고정되니 그만큼 비운다 (79)
    <div className={`flex flex-col gap-7 px-5 ${plans.length > 0 ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-10"}`}>
      <MeetupRefresher waiting={!ready && status.status === "open"} every={aroundMeet ? 45_000 : 15_000} />
      <section className="flex flex-col gap-1">
        <h2 className="text-title font-bold tracking-[-0.02em]">{title}</h2>
        <span className="text-meta text-muted">{meetWhen(status.startsAt, status.endsAt)}</span>
        {others.length === 0 && status.invitees.length === 0 && <span className="text-meta text-muted">함께할 분을 기다리는 중이에요</span>}
      </section>

      {status.status === "done" && (
        <Link href={`/meet/${status.id}/visit`} className="flex min-h-14 items-center justify-between gap-3 rounded-[16px] bg-surface px-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-semibold">다녀온 곳 기록</span>
            <span className="text-meta text-muted">1차, 2차 가게와 함께한 사람을 남겨요</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      )}

      {(status.members.length > 1 || status.invitees.length > 0) && <Members members={status.members} invitees={status.invitees} />}

      {/* 함께 정한 코스 — 추천이 나오기 전 · 끝난 약속은 여기, 추천이 있으면 결과 안 지도 위 (84 · 89) */}
      {status.isMember && !(plans.length > 0) && <CourseCard meetupId={status.id} course={course} editable={status.status === "open"} meet={meet} />}

      {ready ? (
        <>
          <MeetupResults
            plans={plans}
            meetupUrl={`${origin}/meet/${status.id}`}
            waitingCount={status.members.length - readyCount}
            endsAt={status.endsAt}
            meetupId={status.id}
            course={course}
            meet={meet}
            before={plans.length > 0 ? myPoints : null}
            editable={status.status === "open"}
          />
          {plans.length === 0 && myPoints}
          {invite}
        </>
      ) : (
        <>
          {status.status !== "open" ? null : status.meReady ? (
            myPoints
          ) : (
            // 출발지는 각자 넣는다 (67, 위밋플레이스) — 내 할 일을 가장 눈에 띄게
            <section className="flex flex-col gap-2 rounded-[16px] border border-line-strong p-4">
              <span className="flex flex-col gap-0.5">
                <h3 className="text-[16px] font-bold">내 출발지 넣기</h3>
                <span className="text-meta text-ink-2">동네 정도로만 저장하고, 다른 분에게는 보이지 않아요</span>
              </span>
              {editors}
            </section>
          )}
          {status.status === "open" && <section className="flex flex-col gap-0.5 rounded-[16px] border border-line p-4">
            <h3 className="text-body font-bold">추천 지역</h3>
            <span className="text-meta leading-normal text-muted">
              {status.meReady ? (readyCount < 2 ? "다른 분이 출발지를 넣으면 모두 오가기 편한 곳 3곳이 나와요" : "") : readyCount >= 1 ? `${readyCount}명이 출발지를 넣었어요. 내 출발지만 넣으면 나와요` : "2명 이상 출발지를 넣으면 모두 오가기 편한 곳 3곳이 나와요"}
            </span>
          </section>}
          {/* 만날 곳 — 출발지 없이도 정할 수 있음. 정하면 근처 가게로 코스를 담는다 (91) */}
          {status.status === "open" &&
            (aroundMeet ? (
              <MeetupResults
                plans={plans}
                meetupUrl={`${origin}/meet/${status.id}`}
                waitingCount={0}
                endsAt={status.endsAt}
                meetupId={status.id}
                course={course}
                meet={meet}
                editable
              />
            ) : (
              <MeetPointCard meetupId={status.id} meet={null} suggested={null} options={[]} />
            ))}
          {invite}
        </>
      )}

      {status.status === "open" && !ready && (status.invitees.length > 0 || others.length > 0 || status.meReady) && <PushToggle variant="strip" />}

      {status.status === "open" && status.isMember && <CloseMeetup meetupId={status.id} canDone={ready || course.stops.length > 0} role={status.isHost ? "host" : "member"} />}
    </div>
  );
}
