import type { Cuisine } from "./cuisine";
import { scoreCandidate, type Candidate, type Scored } from "./eatScore";

// 약속 목적 — 음식 종류마다 얼마나 어울리는지 (1 잘 맞음 · 0.5 무난 · 그 아래는 거의 안 맞음)
export const PURPOSES = ["meal", "team", "date", "drinks", "cafe"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const PURPOSE_LABEL: Record<Purpose, string> = {
  meal: "가벼운 식사",
  team: "회식 · 모임",
  date: "데이트",
  drinks: "술 한잔",
  cafe: "카페",
};

const FIT: Record<Purpose, Partial<Record<Cuisine, number>>> = {
  meal: { korean: 1, snack: 1, japanese: 0.9, chinese: 0.9, asian: 0.9, western: 0.7, chicken: 0.5, other: 0.6, cafe: 0.25, bar: 0.15 },
  team: { korean: 1, chinese: 1, bar: 0.9, chicken: 0.8, japanese: 0.7, asian: 0.6, western: 0.5, other: 0.5, snack: 0.3, cafe: 0.1 },
  date: { western: 1, japanese: 1, asian: 0.9, cafe: 0.8, bar: 0.7, korean: 0.6, chinese: 0.5, other: 0.6, chicken: 0.3, snack: 0.3 },
  drinks: { bar: 1, chicken: 0.9, korean: 0.8, japanese: 0.7, chinese: 0.6, western: 0.5, asian: 0.5, other: 0.5, snack: 0.2, cafe: 0.1 },
  cafe: { cafe: 1, western: 0.3, other: 0.2 },
};
// 표에 없는 음식 종류 — 카페 약속은 거의 안 맞음, 그 밖은 무난보다 조금 낮게
const DEFAULT_FIT: Record<Purpose, number> = { meal: 0.4, team: 0.4, date: 0.4, drinks: 0.4, cafe: 0.1 };
const MIN_FIT = 0.3;
const PARTNER_BOOST = 1.3;
const AREA_RADIUS = 1000;
const PER_AREA = 4;

export function purposeFit(purpose: Purpose, cuisine: Cuisine): number {
  return FIT[purpose][cuisine] ?? DEFAULT_FIT[purpose];
}

// 한 지역의 가게 — '나에게' 맞는 정도 × 목적 어울림, 같이 가는 사람이 좋게 본 곳은 더 위로
export function planAreaShops(
  candidates: Candidate[],
  area: { lat: number; lng: number },
  purpose: Purpose,
  pref: Partial<Record<Cuisine, number>>,
  partner: { id: string; nickname: string } | null,
): Scored[] {
  return candidates
    .flatMap((c) => {
      const fit = purposeFit(purpose, c.cuisine);
      if (fit < MIN_FIT) return [];
      const s = scoreCandidate(c, area, AREA_RADIUS, pref);
      if (!s) return [];
      const byPartner = partner ? c.raters.find((r) => r.userId === partner.id) : undefined;
      const reasons = byPartner
        ? [`같이 가는 ${partner!.nickname}님 ${byPartner.tier === "three" ? "3스타" : "2스타"}`, ...s.reasons.filter((r) => !r.startsWith(`${partner!.nickname} `))]
        : s.reasons;
      return [{ ...s, score: s.score * fit * (byPartner ? PARTNER_BOOST : 1), reasons }];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_AREA);
}

// 지역 이유 — 둘의 어림 이동 시간
export function areaReason(myMinutes: number, partnerMinutes: number): string {
  const gap = Math.abs(myMinutes - partnerMinutes);
  if (gap <= 10) return `두 분 모두 약 ${Math.round((myMinutes + partnerMinutes) / 2 / 5) * 5}분`;
  return `나 약 ${Math.round(myMinutes / 5) * 5}분 · 상대 약 ${Math.round(partnerMinutes / 5) * 5}분`;
}
