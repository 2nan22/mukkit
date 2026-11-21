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
import { MeetupResults } from "@/features/meetup/MeetupResults";
import { PointEditor } from "@/features/meetup/PointEditor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약속" };

function range(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "시간 미정";
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...o }).format(new Date(d));
  const day = f(startsAt, { month: "long", day: "numeric", weekday: "short" });
  const t = (d: string) => f(d, { hour: "numeric", minute: "2-digit" });
  return `${day} ${t(startsAt)}${endsAt ? ` ~ ${t(endsAt)}` : ""} (대략)`;
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
  const ready = status.meReady && status.partnerReady && status.partner;
  const plans = ready ? await planMeetup(supabase, me, status) : [];
  const title = `${PURPOSE_LABEL[status.purpose]} 약속`;

  return (
    <div className="flex flex-col gap-6 px-5 pb-10">
      <section className="flex flex-col gap-1">
        <h2 className="text-title font-bold tracking-tight">{title}</h2>
        <span className="text-meta text-muted">{range(status.startsAt, status.endsAt)}</span>
        <span className="text-meta text-ink-2">{status.partner ? `${status.partner.nickname}님과` : "아직 참여한 분이 없어요"}</span>
      </section>

      {status.isHost && !status.partner && status.inviteToken && <InviteShare url={`${origin}/m/${status.inviteToken}`} title={title} />}

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[16px] font-bold">내 위치</h3>
          <span className="text-meta text-muted">하나만 넣어도 돼요. 동 단위로만 저장하고 상대에게는 보이지 않아요.</span>
        </div>
        <PointEditor meetupId={status.id} kind="origin" current={label("origin")} />
        <PointEditor meetupId={status.id} kind="return" current={label("return")} />
      </section>

      {status.partner && !status.partnerReady && (
        <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-ink-2">{status.partner.nickname}님이 위치를 넣으면 두 분에게 좋은 곳을 보여 드려요.</p>
      )}
      {status.partner && status.partnerReady && !status.meReady && (
        <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-ink-2">출발지나 귀가지를 넣으면 바로 추천해 드려요.</p>
      )}

      {ready && <MeetupResults plans={plans} partnerNickname={status.partner!.nickname} />}

      <CloseMeetup meetupId={status.id} isHost={status.isHost} />
    </div>
  );
}
