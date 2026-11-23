import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
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

type InviteRow = { meetup_id: string; host_nickname: string; purpose: Purpose; status: string; starts_at: string | null; ends_at: string | null; member_count: number; joined: boolean; is_host: boolean; full: boolean };

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: claims }, { data }] = await Promise.all([supabase.auth.getClaims(), supabase.rpc("meetup_invite", { p_token: token })]);
  const invite = (data as InviteRow[] | null)?.[0];
  const signedIn = Boolean(claims?.claims?.sub);

  if (!invite || invite.status !== "open") {
    return (
      <section className="flex flex-col gap-3">
        <Wordmark size="sm" />
        <h1 className="text-title font-bold tracking-tight">열 수 없는 약속이에요</h1>
        <p className="text-body leading-relaxed text-ink-2">이미 끝났거나 취소된 약속이에요. 보낸 분에게 새 링크를 부탁해 보세요.</p>
      </section>
    );
  }
  if (invite.joined || invite.is_host) redirect(`/meet/${invite.meetup_id}`);

  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...o }).format(new Date(d));
  const when = invite.starts_at
    ? `${fmt(invite.starts_at, { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" })}${invite.ends_at ? `~${fmt(invite.ends_at, { hour: "numeric", minute: "2-digit" })}` : ""}쯤`
    : null;

  return (
    <>
      <section className="flex flex-1 flex-col gap-3">
        <Wordmark size="sm" />
        <h1 className="text-title font-bold leading-snug tracking-tight">
          {invite.host_nickname}님이
          <br />
          {PURPOSE_LABEL[invite.purpose]} 약속에 초대했어요
        </h1>
        {when && <p className="text-body text-ink-2">{when}</p>}
        {invite.member_count > 1 && <p className="text-meta text-muted">지금 {invite.member_count}명 참여 중</p>}
        <ol className="mt-3 flex flex-col gap-2.5 rounded-[16px] bg-surface p-4 text-meta leading-normal text-ink-2">
          <li className="flex gap-2"><b className="text-ink">1</b>로그인하고 약속에 참여해요</li>
          <li className="flex gap-2"><b className="text-ink">2</b>출발지나 귀가지를 넣어요 (상대에게는 안 보여요)</li>
          <li className="flex gap-2"><b className="text-ink">3</b>모두 가기 편한 지역 3곳과 가게를 추천해 드려요</li>
        </ol>
      </section>
      <div className="flex flex-col gap-2.5">
        {invite.full ? (
          <p className="text-center text-meta text-danger">정원이 다 찬 약속이에요.</p>
        ) : signedIn ? (
          <JoinButton token={token} />
        ) : (
          <>
            <p className="pb-1 text-center text-meta text-muted">로그인하면 바로 참여할 수 있어요</p>
            <LoginButtons next={`/m/${token}`} />
          </>
        )}
      </div>
    </>
  );
}
