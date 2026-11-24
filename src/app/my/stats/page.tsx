import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { TierIcon } from "@/components/ui/TierIcon";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { TIER_LABEL } from "@/domain/tier";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getMyStats, MIN_RATED, type MyStats } from "@/features/stats/myStats";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "내 기록 통계" };

// 내 기록 통계 (68, 사용자 결정 2026-11-24 '심플하게 핵심만') — 저장 · 평가 · 내 등급 · 많이 저장한 음식 · 평가한 곳이 많은 동네
export default function MyStatsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/my" title="내 기록 통계" />
      <Suspense fallback={<ListSkeleton />}>
        <Stats />
      </Suspense>
    </main>
  );
}

async function Stats() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const s = await getMyStats(supabase, me);
  const enough = s.rated >= MIN_RATED;

  // 저장한 곳이 없으면 통계 대신 가져오기로
  if (s.saved === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 pb-24 text-center">
        <span className="text-body font-semibold">아직 저장한 곳이 없어요</span>
        <span className="text-meta text-muted">네이버나 카카오 리스트를 가져오면 바로 채워져요</span>
        <Link href="/import" className="mt-2 flex h-11 items-center rounded-btn-m bg-surface px-4 text-body font-semibold text-ink">
          저장한 장소 가져오기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 px-5 pt-2 pb-10">
      <section aria-label="요약" className="grid grid-cols-2 rounded-[16px] border border-line">
        {[
          ["저장", s.saved],
          ["평가", s.rated],
        ].map(([label, n], i) => (
          <div key={label as string} className={`flex flex-col items-center gap-0.5 py-4 ${i > 0 ? "border-l border-line" : ""}`}>
            <b className="text-[22px] tabular-nums">{(n as number).toLocaleString("ko-KR")}</b>
            <span className="text-meta text-muted">{label}</span>
          </div>
        ))}
      </section>

      {s.unrated > 0 && (
        <Link href="/rate" className="-mt-4 flex min-h-12 items-center justify-between rounded-[12px] bg-surface px-4 text-body">
          <span>
            평가 전 <b>{s.unrated.toLocaleString("ko-KR")}</b>곳
          </span>
          <span className="text-meta font-semibold">빠르게 평가하기 ›</span>
        </Link>
      )}

      {/* 평가가 적으면 등급 · 동네 대신 안내 한 번 */}
      {enough ? (
        <Section title="내 등급" more={{ href: "/lists?view=tier", label: "등급별 보기" }}>
          <TierBars s={s} />
        </Section>
      ) : (
        <p className="rounded-[12px] bg-surface px-4 py-3.5 text-meta leading-normal text-ink-2">
          {MIN_RATED}곳을 평가하면 내 등급과 동네를 볼 수 있어요. 지금 {s.rated}곳이에요.
        </p>
      )}

      {s.cuisines.length > 0 && (
        <Section title="많이 저장한 음식">
          <Ranked items={s.cuisines.map((c) => ({ label: CUISINE_LABEL[c.cuisine], count: c.count }))} />
        </Section>
      )}

      {enough && s.regions.length > 0 && (
        <Section title="평가한 곳이 많은 동네">
          <Ranked items={s.regions.map((r) => ({ label: r.region, count: r.count }))} />
        </Section>
      )}

      <p className="text-center text-caption text-muted">이 통계는 나만 볼 수 있어요</p>
    </div>
  );
}

function Section({ title, more, children }: { title: string; more?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section font-bold">{title}</h2>
        {more && (
          <Link href={more.href} className="flex h-11 items-center text-meta font-semibold text-ink-2">
            {more.label} ›
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// 평가한 곳의 등급 — 색은 숟가락 아이콘에만, 막대는 한 색으로 조용하게
function TierBars({ s }: { s: MyStats }) {
  const max = Math.max(1, ...s.tiers.map((t) => t.count));
  return (
    <div className="flex flex-col gap-2.5">
      {s.tiers.map((t) => (
        <div key={t.tier} className="grid grid-cols-[92px_1fr_48px] items-center gap-2 text-body">
          <span className="flex items-center gap-1.5">
            <TierIcon tier={t.tier} height={14} />
            {TIER_LABEL[t.tier]}
          </span>
          <span className="h-2 rounded-full bg-surface">
            <span className="block h-2 rounded-full bg-ink-2" style={{ width: `${(t.count / max) * 100}%` }} />
          </span>
          <span className="text-right text-meta text-muted tabular-nums">{t.count}곳</span>
        </div>
      ))}
    </div>
  );
}

function Ranked({ items }: { items: { label: string; count: number }[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((it, i) => (
        <li key={it.label} className="flex min-h-11 items-center gap-3 border-b border-line text-body last:border-b-0">
          <b className="w-4 text-muted">{i + 1}</b>
          <span className="flex-1 truncate">{it.label}</span>
          <span className="text-meta text-muted tabular-nums">{it.count}곳</span>
        </li>
      ))}
    </ol>
  );
}
