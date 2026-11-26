import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { FollowButton } from "@/features/social/FollowButton";
import {
  getFollowList,
  getMyFollowingIds,
  type FollowKind,
} from "@/features/social/follows";
import { getFollowCounts, getPerson } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBlockedIds } from "@/features/safety/safety";

export const metadata = { title: "팔로우" };

// 팔로워 · 팔로잉 (74) — 인스타그램 · 스레드처럼 두 탭, 줄을 누르면 그 사람 프로필
export default function FollowsPage({
  params,
  searchParams,
}: PageProps<"/u/[userId]/follows">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <Suspense fallback={<AppHeader kind="back" fallback="/home" title="" />}>
        <Header params={params} />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <Follows params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Header({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const person = await getPerson(await createSupabaseServerClient(), userId);
  return (
    <AppHeader
      kind="back"
      fallback={`/u/${userId}`}
      title={person?.nickname ?? ""}
    />
  );
}

async function Follows({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ userId }, { tab }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(userId)) notFound();
  const kind: FollowKind = tab === "following" ? "following" : "followers";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub ?? null;
  const [person, counts, people, myFollowing, blockedIds] = await Promise.all([
    getPerson(supabase, userId),
    getFollowCounts(supabase, userId),
    getFollowList(supabase, userId, kind),
    me ? getMyFollowingIds(supabase, me) : Promise.resolve(new Set<string>()),
    me && me !== userId ? getBlockedIds(supabase) : Promise.resolve(new Set<string>()),
  ]);
  // 차단한 사이면 없는 계정과 같은 화면 — 프로필과 같게 (74-2 검토)
  if (!person || blockedIds.has(userId)) notFound();
  const own = me === userId;
  const empty =
    kind === "following"
      ? "아직 팔로우하는 사람이 없어요"
      : own
        ? "아직 나를 팔로우하는 사람이 없어요"
        : "아직 팔로워가 없어요";

  return (
    <>
      <div role="tablist" className="grid grid-cols-2 border-b border-line">
        {(["followers", "following"] as const).map((k) => (
          <Link
            key={k}
            role="tab"
            aria-selected={kind === k}
            href={
              k === "followers"
                ? `/u/${userId}/follows`
                : `/u/${userId}/follows?tab=following`
            }
            replace
            className={`flex h-11 items-center justify-center text-body ${kind === k ? "border-b-2 border-ink font-bold" : "text-subtle"}`}
          >
            {k === "followers" ? "팔로워" : "팔로잉"}{" "}
            {k === "followers" ? counts.followers : counts.following}
          </Link>
        ))}
      </div>
      {people.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-meta text-muted">{empty}</p>
          {own && kind === "following" && (
            <Link
              href="/people"
              className="text-meta font-bold text-ink underline underline-offset-[3px]"
            >
              사람 찾기
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col px-5">
          {people.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 border-b border-line py-3"
            >
              <Link
                href={`/u/${p.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar name={p.nickname} size={40} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body font-semibold">
                    {p.nickname}
                  </span>
                  {p.bio && (
                    <span className="truncate text-meta text-muted">
                      {p.bio}
                    </span>
                  )}
                </span>
              </Link>
              {me && me !== p.id && (
                <FollowButton
                  targetId={p.id}
                  following={myFollowing.has(p.id)}
                  followLabel={own && kind === "followers" ? "맞팔로우" : "팔로우"}
                  compact
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
