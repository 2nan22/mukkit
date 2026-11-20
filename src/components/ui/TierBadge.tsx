import { TIER_LABEL, type Tier } from "@/domain/tier";

const TIER_STYLE: Record<Tier, string> = {
  three: "bg-tier-3 text-white",
  two: "bg-tier-2-soft text-tier-2",
  one: "bg-tier-1-soft text-tier-1",
  notRecommended: "bg-surface-2 text-muted",
  wantToGo: "bg-surface-2 text-ink-2",
  unrated: "border border-line-strong text-ink-2",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      data-tier={tier}
      className={`inline-flex h-5 items-center whitespace-nowrap rounded px-1.5 text-caption font-bold ${TIER_STYLE[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
