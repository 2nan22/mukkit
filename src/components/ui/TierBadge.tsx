import { BrandSymbol } from "@/components/brand/Wordmark";
import { TIER_LABEL, type Tier } from "@/domain/tier";

const TIER_STYLE: Record<Tier, string> = {
  three: "bg-tier-3 px-2 text-white",
  two: "bg-tier-2-soft px-2 text-tier-2",
  one: "bg-tier-1-soft px-2 text-tier-1",
  notRecommended: "bg-surface px-2 text-muted",
  wantToGo: "text-muted",
  unrated: "border border-line-strong px-2 text-muted",
};

const STARRED: Tier[] = ["three", "two", "one"];

// 수저 셋 · 둘 · 하나는 수저 심볼을 붙여 훈장처럼, 가고 싶은 곳은 가장 흔하니 조용하게
export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      data-tier={tier}
      className={`inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[6px] text-[12px] font-semibold ${TIER_STYLE[tier]}`}
    >
      {STARRED.includes(tier) && <BrandSymbol height={11} className="fill-current" />}
      {tier === "wantToGo" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
      )}
      {TIER_LABEL[tier]}
    </span>
  );
}
