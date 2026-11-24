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
import { getMeetupStatus, getMyPoints, planMeetup, type MeetupMember } from "@/features/meetup/meetup";
import { MeetupRefresher } from "@/features/meetup/MeetupRefresher";
import { MeetupResults } from "@/features/meetup/MeetupResults";
import { PointEditor } from "@/features/meetup/PointEditor";
import { PushToggle } from "@/features/push/PushToggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약속" };

// 사람마다 상태 (67) — 출발지 넣음 · 출발지 전 · 수락 기다리는 중 (위치 값은 보이지 않음)
function Members({ members, invitees }: { members: MeetupMember[]; invitees: { id: string; nickname: string }[] }) {
  const ready = members.filter((m) => m.ready).length;
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[16px] font-bold">함께하는 사람</h3>
        <span className="text-meta text-muted">
          출발지 넣은 사람 {ready}명
        </span>
      </div>
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
  if (!status) notFound();
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
  const plans = ready ? await planMeetup(supabase, me, status) : [];
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

  return (
    <div className="flex flex-col gap-7 px-5 pb-10">
      <MeetupRefresher waiting={!ready && status.status === "open"} />
      <section className="flex flex-col gap-1">
        <h2 className="text-title font-bold tracking-tight">{title}</h2>
        <span className="text-meta text-muted">{meetWhen(status.startsAt, status.endsAt)}</span>
        {others.length === 0 && status.invitees.length === 0 && <span className="text-meta text-muted">함께할 분을 기다리는 중이에요</span>}
      </section>

      {status.status === "done" && (
        <Link href={`/meet/${status.id}/visit`} className="flex min-h-14 items-center justify-between gap-3 rounded-[16px] bg-surface px-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-semibold">다녀온 곳 기록</span>
            <span className="text-meta text-muted">1차 · 2차 가게와 함께한 사람을 남겨요</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      )}

      {(status.members.length > 1 || status.invitees.length > 0) && <Members members={status.members} invitees={status.invitees} />}

      {ready ? (
        <>
          <MeetupResults plans={plans} meetupUrl={`${origin}/meet/${status.id}`} waitingCount={status.members.length - readyCount} />
          <details className="group rounded-[16px] bg-surface">
            <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-meta">
              <span className="truncate text-ink-2">
                내 위치 · 출발 {label("origin") ?? "없음"} · 귀가 {label("return") ?? "없음"}
              </span>
              <span className="shrink-0 font-semibold text-ink group-open:hidden">바꾸기</span>
            </summary>
            <div className="flex flex-col gap-2 px-2 pb-2">{editors}</div>
          </details>
          {invite}
        </>
      ) : (
        <>
          {status.meReady ? (
            <details className="group rounded-[16px] bg-surface">
              <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-meta">
                <span className="truncate text-ink-2">
                  내 위치 · 출발 {label("origin") ?? "없음"} · 귀가 {label("return") ?? "없음"}
                </span>
                <span className="shrink-0 font-semibold text-ink group-open:hidden">바꾸기</span>
              </summary>
              <div className="flex flex-col gap-2 px-2 pb-2">{editors}</div>
            </details>
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
          <section className="flex flex-col gap-0.5 rounded-[16px] border border-line p-4">
            <h3 className="text-body font-bold">추천 지역</h3>
            <span className="text-meta leading-normal text-muted">
              {status.meReady ? (readyCount < 2 ? "다른 분이 출발지를 넣으면 모두 오가기 편한 곳 3곳이 나와요" : "") : readyCount >= 1 ? `${readyCount}명이 출발지를 넣었어요. 내 출발지만 넣으면 나와요` : "2명 이상 출발지를 넣으면 모두 오가기 편한 곳 3곳이 나와요"}
            </span>
          </section>
          {invite}
        </>
      )}

      {status.status === "open" && !ready && (status.invitees.length > 0 || others.length > 0 || status.meReady) && <PushToggle variant="strip" />}

      <CloseMeetup meetupId={status.id} mode={ready ? "done" : status.isHost ? "cancel" : null} />
    </div>
  );
}
