import type { Tier } from "@/domain/tier";

// 등급 아이콘 — 3 · 2 · 1숟가락은 색 숟가락, 추천 안 함은 사선 그은 회색 숟가락,
// 가고 싶은 곳은 깃발(남의 리스트 '가고 싶은 곳으로 저장'과 같은 모양), 평가 전은 속이 빈 숟가락 (41, 사용자 결정 2026-11-23)
// 도형은 BrandSymbol(components/brand/Wordmark.tsx)과 같은 숟가락 · 젓가락
const SPOON =
  '<path d="M336 470C356 496 372 522 374 554L358 850a42 42 0 0 0 84 0L426 554C428 522 444 496 464 470Z"/><ellipse cx="400" cy="312" rx="172" ry="184"/><path d="M596 170a30 30 0 0 1 60 0L647 870a21 21 0 0 1 -42 0Z"/><path d="M700 170a30 30 0 0 1 60 0L751 870a21 21 0 0 1 -42 0Z"/>';
const FLAG = '<path d="M6 21V4h11l-2 4 2 4H6"/>';

const SPOON_COLOR: Partial<Record<Tier, string>> = { three: "#b42330", two: "#e8590c", one: "#f5a524" };
const MUTED = "#8a8e96";

// 지도 핀처럼 DOM 문자열이 필요한 곳에서도 같은 모양을 쓰도록 문자열로 만든다
// color: 숟가락 · 깃발 색 (없으면 등급 기본색, 'currentColor' 가능)
export function tierIconSvg(tier: Tier, height: number, color?: string): string {
  const w = Math.round(height * 0.7);
  if (tier === "wantToGo") {
    return `<svg width="${height}" height="${height}" viewBox="0 0 24 24" fill="${color ?? "#17181c"}" stroke="${color ?? "#17181c"}" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${FLAG}</svg>`;
  }
  const c = color ?? SPOON_COLOR[tier] ?? MUTED;
  if (tier === "unrated") {
    return `<svg width="${w}" height="${height}" viewBox="200 100 588 820" fill="none" stroke="${c}" stroke-width="48" aria-hidden="true">${SPOON}</svg>`;
  }
  if (tier === "notRecommended") {
    // 사선 둘레를 마스크로 비워 어떤 바탕에서도 선이 떨어져 보이게
    const id = `nr${height}${c.replace(/\W/g, "")}`;
    return `<svg width="${w}" height="${height}" viewBox="220 120 548 780" aria-hidden="true"><mask id="${id}"><rect x="0" y="0" width="1000" height="1000" fill="#fff"/><path d="M250 880L760 140" stroke="#000" stroke-width="130"/></mask><g fill="${c}" mask="url(#${id})">${SPOON}</g><path d="M250 880L760 140" stroke="${c}" stroke-width="54" stroke-linecap="round"/></svg>`;
  }
  return `<svg width="${w}" height="${height}" viewBox="220 120 548 780" fill="${c}" aria-hidden="true">${SPOON}</svg>`;
}

export function TierIcon({ tier, height = 13, color }: { tier: Tier; height?: number; color?: string }) {
  return <span aria-hidden="true" className="inline-flex shrink-0" dangerouslySetInnerHTML={{ __html: tierIconSvg(tier, height, color) }} />;
}

const COUNT: Partial<Record<Tier, number>> = { three: 3, two: 2, one: 1 };

// 숟가락 개수로 높낮이 — 3 · 2 · 1숟가락은 색 숟가락 n개 + 회색 나머지, 그 밖은 아이콘 하나 (리스트 탭 등급 줄)
// fit: 줄 맞춤용 고정 너비 없이 아이콘 너비만 (피드 등급 알약, 81)
export function TierSpoons({ tier, height = 15, fit = false }: { tier: Tier; height?: number; fit?: boolean }) {
  const n = COUNT[tier];
  const html = n
    ? [0, 1, 2].map((k) => tierIconSvg(tier, height, k < n ? undefined : "#e3e1dd")).join("")
    : tierIconSvg(tier, height);
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center gap-0.5 ${fit ? "" : "w-[46px]"}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
