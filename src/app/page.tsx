import { TierBadge } from "@/components/ui/TierBadge";
import { TIERS, TIER_MEANING } from "@/domain/tier";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-title font-bold tracking-tight">마이슐랭</h1>
      <ul className="flex flex-col divide-y divide-line">
        {TIERS.map((tier) => (
          <li key={tier} className="flex items-center gap-3 py-3">
            <span className="w-20 shrink-0">
              <TierBadge tier={tier} />
            </span>
            <span className="text-body text-ink-2">{TIER_MEANING[tier]}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
