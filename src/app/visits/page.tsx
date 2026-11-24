import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { honor } from "@/domain/honor";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { TagAnswer } from "@/features/visit/TagAnswer";
import { getReceivedTags } from "@/features/visit/visit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MetaLine } from "@/components/ui/MetaLine";

export const metadata = { title: "함께 방문 요청" };

function day(d: string | null): string {
  if (!d) return "";
  const [, m, dd] = d.split("-").map(Number);
  return `${m}월 ${dd}일 방문`;
}

export default function VisitsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/home" title="함께 방문 요청" />
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <Tags />
      </Suspense>
    </main>
  );
}

async function Tags() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  const tags = await getReceivedTags(supabase);
  if (tags.length === 0) {
    return <p className="px-8 py-12 text-center text-meta leading-normal text-muted">받은 함께 방문 요청이 없어요.</p>;
  }
  return (
    <ul className="flex flex-col gap-3 px-5 pb-10">
      {tags.map((t) => (
        <li key={t.visitId} className="flex flex-col gap-3 rounded-[16px] bg-surface p-4">
          <div className="flex items-center gap-2.5">
            <Avatar name={t.creatorNickname} size={40} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body leading-snug">
                <Link href={`/u/${t.creatorId}`} className="font-bold">
                  {honor(t.creatorNickname)}
                </Link>
                이 함께 갔다고 남겼어요
              </span>
              <MetaLine
                items={[
                  <Link key="place" href={`/p/${t.placeId}`} className="font-semibold text-ink-2">
                    {t.placeName}
                  </Link>,
                  t.visitedOn && day(t.visitedOn),
                ]}
              />
              <span className="text-caption text-muted">수락하면 내 장소에 저장되고, {honor(t.creatorNickname)} 평가에 내 이름이 보여요.</span>
            </span>
          </div>
          <TagAnswer visitId={t.visitId} />
        </li>
      ))}
    </ul>
  );
}
