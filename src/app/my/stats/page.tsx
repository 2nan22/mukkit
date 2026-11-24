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

// 내 기록 통계 (68, 사용자 결정 2026-11-24 '심플하게 핵심만') — 숫자 셋 · 내 등급 · 많이 저장한 음식 · 평가한 곳이 많은 동네
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
  return (
    <div className="flex flex-col gap-7 px-5 pt-2 pb-10">
      <section aria-label="요약" className="grid grid-cols-3 rounded-[16px] border border-line">
        {[
          ["저장", s.saved],
          ["평가", s.rated],
          ["3숟가락", s.three],
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
          <span className="text-meta font-semibold">빠르게 평가 ›</span>
        </Link>
      )}

      <Section title="내 등급">
        {enough ? <TierBars s={s} /> : <NotYet rated={s.rated} />}
      </Section>

      {s.cuisines.length > 0 && (
        <Section title="많이 저장한 음식">
          <Ranked items={s.cuisines.map((c) => ({ label: CUISINE_LABEL[c.cuisine], count: c.count }))} />
        </Section>
      )}

      <Section title="평가한 곳이 많은 동네">
        {enough && s.regions.length > 0 ? <Ranked items={s.regions.map((r) => ({ label: r.region, count: r.count }))} /> : <NotYet rated={s.rated} />}
      </Section>

      <p className="text-center text-caption text-muted">이 통계는 나만 볼 수 있어요</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-bold">{title}</h2>
      {children}
    </section>
  );
}

// 평가한 곳의 등급 — 숟가락 아이콘 · 이름 · 막대 · 숫자 (색만으로 나누지 않게)
function TierBars({ s }: { s: MyStats }) {
  const max = Math.max(1, ...s.tiers.map((t) => t.count));
  return (
    <Link href="/lists?view=tier" className="flex flex-col gap-2.5" aria-label={`내 등급 · ${s.tiers.map((t) => `${TIER_LABEL[t.tier]} ${t.count}곳`).join(" · ")} · 등급별 보기`}>
      {s.tiers.map((t) => (
        <div key={t.tier} className="grid grid-cols-[92px_1fr_40px] items-center gap-2 text-body">
          <span className="flex items-center gap-1.5">
            <TierIcon tier={t.tier} height={14} />
            {TIER_LABEL[t.tier]}
          </span>
          <span className="h-2 rounded-full bg-surface">
            <span className={`block h-2 rounded-full ${BAR[t.tier]}`} style={{ width: `${(t.count / max) * 100}%` }} />
          </span>
          <span className="text-right text-meta text-muted tabular-nums">{t.count}</span>
        </div>
      ))}
    </Link>
  );
}

const BAR: Record<MyStats["tiers"][number]["tier"], string> = { three: "bg-tier-3", two: "bg-tier-2", one: "bg-tier-1", notRecommended: "bg-pin-none" };

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

function NotYet({ rated }: { rated: number }) {
  return (
    <p className="rounded-[12px] bg-surface px-4 py-3.5 text-meta leading-normal text-ink-2">
      {MIN_RATED}곳을 평가하면 볼 수 있어요 · 지금 {rated}곳
    </p>
  );
}
