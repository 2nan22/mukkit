import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { PURPOSE_LABEL } from "@/domain/meetup";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { CloseMeetup } from "@/features/meetup/CloseMeetup";
import { InviteShare } from "@/features/meetup/InviteShare";
import { getMeetupStatus, getMyPoints, planMeetup } from "@/features/meetup/meetup";
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
  const points = await getMyPoints(supabase, meetupId);
  const label = (k: "origin" | "return") => points.find((p) => p.kind === k)?.label ?? null;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const ready = Boolean(status.meReady && status.partnerReady && status.partner);
  const plans = ready ? await planMeetup(supabase, me, status) : [];
  const purpose = PURPOSE_LABEL[status.purpose];
  const title = status.partner ? `${status.partner.nickname}님과 ${purpose}` : `${purpose} 약속`;

  const editors = (
    <>
      <PointEditor meetupId={status.id} kind="origin" current={label("origin")} />
      <PointEditor meetupId={status.id} kind="return" current={label("return")} />
    </>
  );

  return (
    <div className="flex flex-col gap-7 px-5 pb-10">
      <MeetupRefresher waiting={!ready && status.status === "open"} />
      <section className="flex flex-col gap-1">
        <h2 className="text-title font-bold tracking-tight">{title}</h2>
        <span className="text-meta text-muted">
          {range(status.startsAt, status.endsAt)}
          {!status.partner && " · 상대를 기다리는 중이에요"}
        </span>
      </section>

      {ready ? (
        <>
          <MeetupResults plans={plans} partnerNickname={status.partner!.nickname} meetupUrl={`${origin}/meet/${status.id}`} />
          <details className="group rounded-[16px] bg-surface">
            <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-meta">
              <span className="truncate text-ink-2">
                내 위치 · 출발 {label("origin") ?? "없음"} · 귀가 {label("return") ?? "없음"}
              </span>
              <span className="shrink-0 font-semibold text-ink group-open:hidden">바꾸기</span>
            </summary>
            <div className="flex flex-col gap-2 px-2 pb-2">{editors}</div>
          </details>
        </>
      ) : (
        <>
          {status.isHost && !status.partner && status.inviteToken && (
            <Step n={1} title="링크 보내기">
              <InviteShare url={`${origin}/m/${status.inviteToken}`} title={`${purpose} 약속`} />
            </Step>
          )}
          <Step n={status.isHost && !status.partner ? 2 : 1} title="내 위치 넣기" hint="하나만 넣어도 돼요. 동네 정도로만 저장하고, 상대에게는 보이지 않아요.">
            {editors}
          </Step>
          {status.partner && !status.partnerReady && status.meReady && (
            <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-ink-2">{status.partner.nickname}님이 위치를 넣는 중이에요. 넣으면 바로 추천이 나와요.</p>
          )}
          {status.partner && status.partnerReady && !status.meReady && (
            <p className="rounded-[16px] bg-brand-soft p-4 text-meta leading-normal text-ink-2">{status.partner.nickname}님은 위치를 넣었어요. 내 위치만 넣으면 추천이 나와요.</p>
          )}
        </>
      )}

      <CloseMeetup meetupId={status.id} mode={ready ? "done" : status.isHost && !status.partner ? "cancel" : null} />
    </div>
  );
}
