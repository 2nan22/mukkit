import Link from "next/link";
import { Character, CHARACTER_INFO, isCharacterId } from "@/components/growth/Character";
import { branchOf, growthTotal, levelOf, nextHint, type GrowthCounts } from "@/domain/growth";
import { CharacterPicker } from "./CharacterPicker";

// 내 정보 맨 위 — 고른 캐릭터 · 레벨 · 다음 레벨까지 한 줄. 아직 안 골랐으면 고르기부터. 나만 본다
export function GrowthCard({ counts }: { counts: GrowthCounts }) {
  const lv = levelOf(growthTotal(counts));
  if (!isCharacterId(counts.character)) {
    return (
      <section className="flex flex-col gap-3 rounded-[16px] border border-line p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-body font-bold">키울 캐릭터를 골라 주세요</h2>
          <p className="text-meta text-muted">평가할수록 자라요. 나중에 바꿀 수 있어요.</p>
        </div>
        <CharacterPicker stage={lv.stage} />
      </section>
    );
  }
  const id = counts.character;
  const branch = branchOf(counts.topKind, lv.stage);
  const ratio = lv.max ? 1 : lv.into / lv.need;
  return (
    <Link href="/my/growth" className="flex items-center gap-4 rounded-[16px] border border-line px-4 py-3.5">
      <Character id={id} stage={lv.stage} branch={branch} size={64} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-body font-bold">{CHARACTER_INFO[id].name}</span>
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
