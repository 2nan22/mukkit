import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PageLoader } from "@/components/ui/EatingLoader";
import { PURPOSE_LABEL } from "@/domain/meetup";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { KakaoInvite } from "@/features/meetup/KakaoInvite";
import { getMeetupStatus } from "@/features/meetup/meetup";
import { QuickInvite } from "@/features/meetup/QuickInvite";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약속 초대" };

function when(startsAt: string | null): string {
  if (!startsAt) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(startsAt));
}

// 약속을 만든 직후 · '친구 더 초대하기' (67) — 만든 뒤 바로 초대 (Partiful · Doodle · Apple 초대)
export default function MeetInvitePage({ params, searchParams }: PageProps<"/meet/[meetupId]/invite">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <Suspense fallback={<PageLoader />}>
        <Invite params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Invite({ params, searchParams }: { params: Promise<{ meetupId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { meetupId } = await params;
  const created = (await searchParams).created === "1";
  if (!/^[0-9a-f-]{36}$/.test(meetupId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  const status = await getMeetupStatus(supabase, meetupId);
  if (!status) notFound();
  const back = `/meet/${status.id}`;
  if (!status.isHost || status.status !== "open" || !status.inviteToken) redirect(back);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const purpose = PURPOSE_LABEL[status.purpose];
  const left = status.maxMembers - status.members.length;

  return (
    <>
      <AppHeader kind="close" fallback={back} title={created ? "" : "친구 초대"} />
      <div className="flex flex-1 flex-col gap-5 px-5 pb-5">
        {created && (
          <section className="flex flex-col items-center gap-1.5 pt-2 text-center">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <h1 className="pt-1 text-[22px] font-bold tracking-tight">약속을 만들었어요</h1>
            <p className="text-meta text-muted">
              {when(status.startsAt)} · {purpose}
            </p>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h2 className="text-body font-semibold">팔로우하는 사람</h2>
          <QuickInvite meetupId={status.id} invited={status.invitees.map((i) => i.id)} memberIds={status.members.map((m) => m.id)} />
          <p className="text-meta text-muted">나를 포함해 {status.maxMembers}명까지 · 남은 자리 {left}명 · 먹킷을 안 쓰는 친구도 링크로 들어와요</p>
        </section>
        <div className="flex-1" />
        <div className="sticky bottom-0 flex flex-col gap-1 bg-white pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <KakaoInvite url={`${origin}/m/${status.inviteToken}`} title={`${purpose} 약속`} />
          <Link href={back} replace className="flex h-11 items-center justify-center text-meta text-muted">
            {created ? "나중에 할게요" : "약속으로 돌아가기"}
          </Link>
        </div>
      </div>
    </>
  );
}
