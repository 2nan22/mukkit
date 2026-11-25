import Link from "next/link";

// 연말 결산 들어가는 줄 (70) — 12 · 1월, 올해 평가가 충분할 때만 부르는 쪽에서 띄운다
export function RecapBanner({ year, className = "" }: { year: number; className?: string }) {
  return (
    <Link href="/my/recap" className={`flex min-h-14 items-center justify-between gap-3 rounded-[16px] bg-[#17181c] px-4 py-3 text-white ${className}`}>
      <span className="flex min-w-0 flex-col">
        <span className="text-body font-bold">{year} 먹킷 결산</span>
        <span className="text-meta text-white/70">올해 매긴 등급을 카드로 돌아봐요</span>
      </span>
      <span className="shrink-0 text-meta font-bold">보기 ›</span>
    </Link>
  );
}
