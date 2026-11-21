import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PURPOSE_LABEL, type Purpose } from "@/domain/meetup";
import { JoinButton } from "@/features/meetup/JoinButton";
import { LoginButtons } from "@/features/onboarding/LoginButtons";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약속 초대", robots: { index: false } };

// 약속 링크 — 로그인 전에도 누가 · 무슨 약속인지 보여 주고, 로그인 뒤 참여
export default function InvitePage({ params }: PageProps<"/m/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-16 pb-6">
      <Suspense fallback={null}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}

type InviteRow = { meetup_id: string; host_nickname: string; purpose: Purpose; status: string; starts_at: string | null; ends_at: string | null; joined: boolean; is_host: boolean; full: boolean };

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: claims }, { data }] = await Promise.all([supabase.auth.getClaims(), supabase.rpc("meetup_invite", { p_token: token })]);
  const invite = (data as InviteRow[] | null)?.[0];
  const signedIn = Boolean(claims?.claims?.sub);

  if (!invite || invite.status !== "open") {
    return (
      <section className="flex flex-col gap-3">
        <span className="text-body font-bold">마이슐랭</span>
        <h1 className="text-title font-bold tracking-tight">열 수 없는 약속이에요</h1>
        <p className="text-body leading-relaxed text-ink-2">약속이 끝났거나 링크가 만료됐어요. 보낸 분에게 다시 받아 주세요.</p>
      </section>
    );
  }
  if (invite.joined || invite.is_host) redirect(`/meet/${invite.meetup_id}`);

  const when = invite.starts_at
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(invite.starts_at))
    : null;

  return (
    <>
      <section className="flex flex-1 flex-col gap-3">
        <span className="text-body font-bold">마이슐랭</span>
        <h1 className="text-title font-bold leading-snug tracking-tight">
          {invite.host_nickname}님이
          <br />
          {PURPOSE_LABEL[invite.purpose]} 약속을 잡았어요
        </h1>
        {when && <p className="text-body text-ink-2">{when}쯤 (대략)</p>}
        <p className="text-body leading-relaxed text-ink-2">출발지나 귀가지를 넣으면 두 분에게 편한 지역과 가게를 함께 찾아 드려요. 위치는 상대에게 보이지 않아요.</p>
      </section>
      <div className="flex flex-col gap-2.5">
        {invite.full ? (
          <p className="text-center text-meta text-danger">이미 다른 분이 참여한 약속이에요.</p>
        ) : signedIn ? (
          <JoinButton token={token} />
        ) : (
          <>
            <p className="pb-1 text-center text-meta text-muted">로그인하면 바로 참여돼요</p>
            <LoginButtons next={`/m/${token}`} />
          </>
        )}
      </div>
    </>
  );
}
