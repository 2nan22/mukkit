import { TierIcon } from "./TierIcon";
import { TIER_LABEL, type Tier } from "@/domain/tier";

const TIER_STYLE: Record<Tier, string> = {
  three: "bg-tier-3 px-2 text-white",
  two: "bg-tier-2-soft px-2 text-tier-2",
  one: "bg-tier-1-soft px-2 text-tier-1",
  notRecommended: "bg-surface px-2 text-muted",
  wantToGo: "text-muted",
  unrated: "border border-line-strong px-2 text-muted",
};

// 등급마다 아이콘(TierIcon)을 붙여 글자를 안 읽어도 갈리게, 가고 싶은 곳은 가장 흔하니 조용하게
export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      data-tier={tier}
      className={`inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[6px] text-[12px] font-semibold ${TIER_STYLE[tier]}`}
    >
      <TierIcon tier={tier} height={11} color="currentColor" />
      {TIER_LABEL[tier]}
    </span>
  );
}
