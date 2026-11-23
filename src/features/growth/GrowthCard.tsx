import Link from "next/link";
import { Character, CHARACTER_NAME } from "@/components/growth/Character";
import { branchOf, growthTotal, levelOf, nextHint, type GrowthCounts } from "@/domain/growth";

// MY 맨 위 — 캐릭터 · 레벨 · 다음 레벨까지 한 줄. 나만 본다
export function GrowthCard({ counts }: { counts: GrowthCounts }) {
  const total = growthTotal(counts);
  const lv = levelOf(total);
  const branch = branchOf(counts.topKind, lv.stage);
  const ratio = lv.max ? 1 : lv.into / lv.need;
  return (
    <Link href="/my/growth" className="flex items-center gap-4 rounded-[16px] border border-line px-4 py-3.5">
      <Character stage={lv.stage} branch={branch} size={56} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-body font-bold">{CHARACTER_NAME}</span>
          <span className="text-meta font-semibold text-ink-2">Lv.{lv.level}</span>
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="다음 레벨까지" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
          <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(4, ratio * 100)}%` }} />
        </span>
        <span className="truncate text-meta text-muted">{nextHint(counts, lv)}</span>
      </span>
    </Link>
  );
}
