import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { PURPOSE_LABEL } from "@/domain/meetup";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { CloseMeetup } from "@/features/meetup/CloseMeetup";
import { InviteAnswer } from "@/features/meetup/InviteAnswer";
import { InvitePicker } from "@/features/meetup/InvitePicker";
import { InviteShare } from "@/features/meetup/InviteShare";
import { getMeetupStatus, getMyPoints, planMeetup, type MeetupMember } from "@/features/meetup/meetup";
import { MeetupRefresher } from "@/features/meetup/MeetupRefresher";
import { MeetupResults } from "@/features/meetup/MeetupResults";
import { PointEditor } from "@/features/meetup/PointEditor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약속" };

function range(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "시간 미정";
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...o }).format(new Date(d));
  const day = f(startsAt, { month: "long", day: "numeric", weekday: "short" });
  const t = (d: string) => f(d, { hour: "numeric", minute: "2-digit" });
  const end = endsAt ? `~${t(endsAt).replace(/^(오전|오후) /, (m) => (t(startsAt).startsWith(m.trim()) ? "" : m))}` : "";
  return `${day} ${t(startsAt)}${end}쯤`;
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-caption font-bold text-white">{n}</span>
        <span className="flex flex-col gap-0.5">
          <h3 className="text-[16px] font-bold">{title}</h3>
          {hint && <span className="text-meta text-muted">{hint}</span>}
        </span>
      </div>
      {children}
    </section>
  );
}

// 참여자 · 위치 입력 현황 (위치 값은 보이지 않음)
function Members({ members, max }: { members: MeetupMember[]; max: number }) {
  const ready = members.filter((m) => m.ready).length;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[16px] font-bold">참여 {members.length}명</h3>
        <span className="text-meta text-muted">
          {ready}명 위치 입력 · 최대 {max}명
        </span>
      </div>
      <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {members.map((m) => (
          <li key={m.id} className="flex w-14 shrink-0 flex-col items-center gap-1">
            <span className="relative">
              <Avatar name={m.nickname} size={40} />
              <span aria-hidden="true" className={`absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-white ${m.ready ? "bg-[#1f9d55]" : "bg-line-strong"}`} />
            </span>
            <span className="w-full truncate text-center text-caption text-ink-2">{m.isMe ? "나" : m.nickname}</span>
            <span className="sr-only">{m.ready ? "위치 입력함" : "위치 입력 전"}</span>
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
        <InviteAnswer meetupId={status.id} hostNickname={status.hostNickname} purposeLabel={purpose} when={range(status.startsAt, status.endsAt)} />
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
  const invite = canInvite && status.inviteToken && (
    <>
      <InvitePicker meetupId={status.id} invited={status.invitees} memberIds={status.members.map((m) => m.id)} />
      <InviteShare url={`${origin}/m/${status.inviteToken}`} title={`${purpose} 약속`} />
    </>
  );

  return (
    <div className="flex flex-col gap-7 px-5 pb-10">
      <MeetupRefresher waiting={!ready && status.status === "open"} />
      <section className="flex flex-col gap-1">
        <h2 className="text-title font-bold tracking-tight">{title}</h2>
        <span className="text-meta text-muted">
          {range(status.startsAt, status.endsAt)}
          {others.length === 0 && " · 함께할 분을 기다리는 중이에요"}
        </span>
      </section>

      {status.members.length > 1 && <Members members={status.members} max={status.maxMembers} />}

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
          {invite && (
            <details className="rounded-[16px] border border-line">
              <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-meta">
                <span className="text-ink-2">더 초대하기</span>
                <span className="font-semibold text-ink">열기</span>
              </summary>
              <div className="flex flex-col gap-2 px-2 pb-2">{invite}</div>
            </details>
          )}
        </>
      ) : (
        <>
          {invite && (
            <Step n={1} title="같이 갈 분 초대" hint={`최대 ${status.maxMembers}명까지 함께할 수 있어요`}>
              {invite}
            </Step>
          )}
          <Step n={invite ? 2 : 1} title="내 위치 넣기" hint="하나만 넣어도 돼요. 동네 정도로만 저장하고, 다른 분에게는 보이지 않아요.">
            {editors}
          </Step>
          {others.length > 0 && status.meReady && readyCount < 2 && (
            <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-ink-2">다른 분이 위치를 넣으면 바로 추천이 나와요.</p>
          )}
          {others.length > 0 && !status.meReady && readyCount >= 1 && (
            <p className="rounded-[16px] bg-brand-soft p-4 text-meta leading-normal text-ink-2">{readyCount}명이 위치를 넣었어요. 내 위치만 넣으면 추천이 나와요.</p>
          )}
        </>
      )}

      <CloseMeetup meetupId={status.id} mode={ready ? "done" : status.isHost ? "cancel" : null} />
    </div>
  );
}
