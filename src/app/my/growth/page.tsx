import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Character, CHARACTER_NAME } from "@/components/growth/Character";
import { BRANCH_LABEL, branchOf, growthItems, growthTotal, ITEM_LABEL, levelOf, nextHint, POINTS } from "@/domain/growth";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getMyGrowth } from "@/features/growth/growth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "레벨" };

export default function GrowthPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" title="레벨" fallback="/my" />
      <main className="flex flex-1 flex-col gap-6 px-5 pb-10">
        <Suspense fallback={<ListSkeleton rows={4} />}>
          <Growth />
        </Suspense>
      </main>
    </div>
  );
}

// 받은 점수 내역 · 점수 받는 법 — 숫자는 domain/growth 의 규칙 그대로
const HOW: [string, string][] = [
  ["평가", `${POINTS.rating}점 · ${POINTS.ratingCap}곳이 넘으면 ${POINTS.ratingAfterCap}점`],
  ["한 줄 평가 10자 이상", `+${POINTS.review}점`],
  ["직접 찍은 사진 · 영상", `+${POINTS.media}점`],
  ["처음 평가한 동네", `+${POINTS.area}점`],
  ["처음 먹어 본 메뉴 종류", `+${POINTS.kind}점`],
  ["나만의 맛집 순위 정하기", `+${POINTS.ranked}점 · 10위까지`],
  ["받은 좋아요", "+2점 · 평가 하나에 20점까지"],
  ["남이 내 리스트를 저장", `+${POINTS.listSave}점`],
  ["함께 간 사람이 수락", `+${POINTS.visit}점`],
];

async function Growth() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  const counts = await getMyGrowth(supabase);
  const total = growthTotal(counts);
  const lv = levelOf(total);
  const branch = branchOf(counts.topKind, lv.stage);
  return (
    <>
      <section className="flex flex-col items-center gap-2 pt-4 text-center">
        <Character stage={lv.stage} branch={branch} size={120} />
        <span className="text-title font-bold">
          {CHARACTER_NAME} <span className="text-ink-2">Lv.{lv.level}</span>
        </span>
        {branch && <span className="text-meta font-semibold text-ink-2">{BRANCH_LABEL[branch]}</span>}
        <span className="text-meta text-muted">{lv.max ? "최고 레벨이에요" : `다음 레벨까지 ${lv.need - lv.into}점`}</span>
        <span className="text-meta text-ink-2">{nextHint(counts, lv)}</span>
      </section>

      <section className="flex flex-col">
        <h2 className="pb-1 text-body font-bold">받은 점수 {total.toLocaleString()}점</h2>
        <ul className="flex flex-col">
          {growthItems(counts)
            .filter((i) => i.points > 0)
            .map((i) => (
              <li key={i.key} className="flex min-h-11 items-center justify-between border-b border-line text-body last:border-b-0">
                <span className="text-ink-2">{ITEM_LABEL[i.key]}</span>
                <span className="font-semibold tabular-nums">{i.points.toLocaleString()}점</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="flex flex-col gap-1 rounded-[16px] bg-surface p-4">
        <h2 className="pb-1 text-body font-bold">점수 받는 법</h2>
        {HOW.map(([what, pts]) => (
          <p key={what} className="flex justify-between gap-3 text-meta">
            <span className="text-ink-2">{what}</span>
            <span className="shrink-0 text-ink">{pts}</span>
          </p>
        ))}
        <p className="pt-2 text-caption leading-normal text-muted">협찬 표시 평가와 신고로 가려진 평가는 세지 않아요. 레벨은 나만 봐요.</p>
      </section>
    </>
  );
}
