import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { honor } from "@/domain/honor";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getMeetupStatus } from "@/features/meetup/meetup";
import { MeetupVisitPicker } from "@/features/visit/MeetupVisitPicker";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "어디서 만났어요?" };

export default function MeetVisitPage({ params }: PageProps<"/meet/[meetupId]/visit">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/meet" title="방문 기록" />
      <Suspense fallback={null}>
        <MeetVisit params={params} />
      </Suspense>
    </main>
  );
}

async function MeetVisit({ params }: { params: Promise<{ meetupId: string }> }) {
  const { meetupId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(meetupId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  const status = await getMeetupStatus(supabase, meetupId);
  if (!status?.isMember) notFound();
  const others = status.members.filter((m) => !m.isMe);

  return (
    <div className="flex flex-col gap-5 px-5 pb-10">
      <section className="flex flex-col gap-1">
        <h2 className="text-title font-bold tracking-tight">어디서 만났어요?</h2>
        <span className="text-meta leading-normal text-muted">
          {others.length === 0 ? "고른 가게를 방문 기록으로 남겨요." : others.length === 1 ? `가게를 고르면 ${honor(others[0].nickname)}에게 요청을 보내요.` : `가게를 고르면 함께한 ${others.length}명에게 요청을 보내요.`}
        </span>
      </section>
      <MeetupVisitPicker meetupId={meetupId} />
      <Link href="/meet" replace className="flex h-11 items-center self-center text-meta text-muted underline underline-offset-[3px]">
        다음에 할게요
      </Link>
    </div>
  );
}
