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

// 지역 이유 — 둘의 예상 이동 시간 (5분 단위)
export function areaReason(myMinutes: number, partnerMinutes: number, partnerNickname: string): string {
  const r5 = (m: number) => Math.round(m / 5) * 5;
  if (Math.abs(myMinutes - partnerMinutes) <= 10) return `두 사람 모두 ${r5((myMinutes + partnerMinutes) / 2)}분쯤`;
  return `나 ${r5(myMinutes)}분쯤 · ${partnerNickname}님 ${r5(partnerMinutes)}분쯤`;
}

// '23:50' → '밤 11:50' · '00:20' → '밤 12:20'
export function nightClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h >= 18 || h < 4 ? "밤" : "오후"} ${h12}:${String(m).padStart(2, "0")}`;
}

// 막차 어림 — 대중교통 API 없이 '귀가가 길수록 일찍 출발'로 어림한다 (분 단위, 자정 넘으면 24*60 이상)
const LAST_DEPARTURE: { maxReturn: number; at: number }[] = [
  { maxReturn: 30, at: 24 * 60 + 20 }, // 0:20
  { maxReturn: 60, at: 23 * 60 + 50 },
  { maxReturn: 90, at: 23 * 60 + 20 },
  { maxReturn: Infinity, at: 22 * 60 + 50 },
];

export function lastDepartureMinutes(returnMinutes: number): number {
  return LAST_DEPARTURE.find((r) => returnMinutes <= r.maxReturn)!.at;
}

export function clock(minutes: number): string {
  const m = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// 끝나는 시각을 한국 시간 '그날 0시부터 분'으로 — 새벽 0~4시는 전날 밤의 연장으로 본다
export function endMinutesKst(endsAt: Date): number {
  const kst = new Date(endsAt.getTime() + 9 * 60 * 60 * 1000);
  const m = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return m < 4 * 60 ? m + 24 * 60 : m;
}

export type AreaScore = { name: string; lat: number; lng: number; myMinutes: number; partnerMinutes: number; myReturn: number | null; partnerReturn: number | null; recent: number };
export type RankedArea = AreaScore & { myLate: boolean; partnerLate: boolean; myLast: string | null; partnerLast: string | null };

// 끝나는 시각이 있으면 막차를 넘기는 사람이 적은 지역부터, 그다음 더 먼 쪽이 짧은 순
export function rankAreas(areas: AreaScore[], endsAt: Date | null, limit = 3): RankedArea[] {
  const end = endsAt ? endMinutesKst(endsAt) : null;
  const ranked = areas.map((a) => {
    const myLastAt = a.myReturn !== null ? lastDepartureMinutes(a.myReturn) : null;
    const partnerLastAt = a.partnerReturn !== null ? lastDepartureMinutes(a.partnerReturn) : null;
    return {
      ...a,
      myLast: myLastAt !== null ? clock(myLastAt) : null,
      partnerLast: partnerLastAt !== null ? clock(partnerLastAt) : null,
      myLate: end !== null && myLastAt !== null && end > myLastAt,
      partnerLate: end !== null && partnerLastAt !== null && end > partnerLastAt,
    };
  });
  const lateCount = (a: RankedArea) => Number(a.myLate) + Number(a.partnerLate);
  return ranked
    .sort((a, b) => lateCount(a) - lateCount(b) || Math.max(a.myMinutes, a.partnerMinutes) - Math.max(b.myMinutes, b.partnerMinutes) || b.recent - a.recent)
    .slice(0, limit);
}
