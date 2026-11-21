import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TierBadge } from "@/components/ui/TierBadge";
import { honor } from "@/domain/honor";
import { tierFromDb } from "@/domain/tier";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getMeetupStatus } from "@/features/meetup/meetup";
import { MeetupVisitPicker } from "@/features/visit/MeetupVisitPicker";
import { RemoveVisit } from "@/features/visit/RemoveVisit";
import { getMeetupVisits, type MeetupVisit } from "@/features/visit/visit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "방문 기록" };

const RATED = ["three", "two", "one", "not_recommended"];

export default function MeetVisitPage({ params, searchParams }: PageProps<"/meet/[meetupId]/visit">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/meet" title="방문 기록" />
      <Suspense fallback={null}>
        <MeetVisit params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function who(v: MeetupVisit): { names: string; waiting: string | null } {
  const live = v.members.filter((m) => m.status !== "declined");
  if (live.length === 0) return { names: "나 혼자", waiting: null };
  const waiting = live.filter((m) => m.status === "invited").length;
  return {
    names: live.map((m) => (m.guest ? m.nickname : honor(m.nickname))).join(" · "),
    waiting: waiting === 0 ? null : waiting === live.length ? "아직 아무도 수락하지 않았어요" : `${waiting}명 수락 전`,
  };
}

async function MeetVisit({ params, searchParams }: { params: Promise<{ meetupId: string }>; searchParams: Promise<{ add?: string | string[] }> }) {
  const [{ meetupId }, { add }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(meetupId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const status = await getMeetupStatus(supabase, meetupId);
  if (!status?.isMember) notFound();
  const others = status.members.filter((m) => !m.isMe).map((m) => ({ id: m.id, nickname: m.nickname }));
  const recorded = await getMeetupVisits(supabase, me, meetupId);
  const back = `/meet/${meetupId}/visit`;
  const adding = recorded.length === 0 || add === "1";

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 pb-10">
      <section className="flex flex-col gap-1">
        <h2 className="text-title font-bold tracking-tight">{recorded.length ? "다녀온 곳" : "어디서 만났어요?"}</h2>
        <span className="text-meta leading-normal text-muted">
          {recorded.length === 0 ? "1차 · 2차처럼 여러 곳을 한 번에 기록할 수 있어요." : adding ? "더 간 곳을 이어서 기록해요." : "가게마다 평가와 함께한 사람을 고칠 수 있어요."}
        </span>
      </section>

      {recorded.length > 0 && (
        <ol className="flex flex-col gap-2">
          {recorded.map((v, i) => {
            const rated = v.myTier && RATED.includes(v.myTier);
            const people = who(v);
            return (
              <li key={v.visitId} className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-caption font-bold text-white">{i + 1}차</span>
                  <Link href={`/p/${v.placeId}`} className="min-w-0 flex-1 truncate text-body font-semibold">
                    {v.placeName}
                  </Link>
                  {rated && <TierBadge tier={tierFromDb(v.myTier!)} />}
                </div>
                <span className="flex flex-col gap-0.5">
                  <span className="text-meta text-ink-2">{people.names}</span>
                  {people.waiting && <span className="text-caption text-muted">{people.waiting}</span>}
                </span>
                <div className="-mb-2 flex min-h-11 items-center justify-between">
                  {rated ? (
                    <Link href={`/rate/${v.placeId}?next=${encodeURIComponent(back)}`} className="flex h-11 items-center text-meta font-semibold text-ink underline underline-offset-[3px]">
                      고치기
                    </Link>
                  ) : (
                    <Link href={`/rate/${v.placeId}?next=${encodeURIComponent(back)}`} className="flex h-9 items-center rounded-full bg-ink px-3.5 text-meta font-semibold text-white">
                      평가하기
                    </Link>
                  )}
                  {v.isCreator && <RemoveVisit visitId={v.visitId} />}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {adding ? (
        <MeetupVisitPicker meetupId={meetupId} people={others} startIndex={recorded.length} cancelHref={recorded.length ? back : undefined} />
      ) : (
        <Link href={`${back}?add=1`} replace className="flex h-11 w-fit items-center gap-1.5 rounded-full bg-surface px-4 text-meta font-semibold text-ink">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {recorded.length + 1}차 가게 추가
        </Link>
      )}

      {recorded.length === 0 && (
        <Link href="/meet" replace className="flex h-11 items-center self-center text-meta text-muted underline underline-offset-[3px]">
          다음에 할게요
        </Link>
      )}
    </div>
  );
}
