import type { Cuisine } from "./cuisine";
import { scoreCandidate, type Candidate, type Scored } from "./eatScore";

// 약속 목적 — 음식 종류마다 얼마나 어울리는지 (1 잘 맞음 · 0.5 무난 · 그 아래는 거의 안 맞음)
// 약속 이름 (96) — 비우면 목적 · 함께하는 사람으로 짓는다
export const MEETUP_TITLE_MAX = 30;
export function cleanMeetupTitle(raw: string | null | undefined): string | null {
  // 폭 없는 공백은 지우고, 글자 단위로 자른다 (이모지 반쪽이 남지 않게)
  const t = Array.from((raw ?? "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/\s+/g, " ").trim()).slice(0, MEETUP_TITLE_MAX).join("").trim();
  return t || null;
}

export const PURPOSES = ["meal", "team", "date", "drinks", "cafe"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const PURPOSE_LABEL: Record<Purpose, string> = {
  meal: "식사",
  team: "모임",
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
  companions: { id: string; nickname: string }[],
): Scored[] {
  const names = new Map(companions.map((c) => [c.id, c.nickname]));
  return candidates
    .flatMap((c) => {
      const fit = purposeFit(purpose, c.cuisine);
      if (fit < MIN_FIT) return [];
      const s = scoreCandidate(c, area, AREA_RADIUS, pref);
      if (!s) return [];
      const byCompanions = c.raters.filter((r) => names.has(r.userId));
      const reasons = byCompanions.length
        ? [
            `같이 가는 ${byCompanions.map((r) => `${r.nickname}님 ${r.tier === "three" ? "3숟가락" : "2숟가락"}`).join(", ")}`,
            ...s.reasons.filter((r) => !byCompanions.some((x) => r.startsWith(`${x.nickname} `))),
          ]
        : s.reasons;
      return [{ ...s, score: s.score * fit * (byCompanions.length ? PARTNER_BOOST : 1), reasons }];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_AREA);
}

// 지역 이유 — 참여자 예상 이동 시간 (5분 단위)
// exact: 모든 구간을 대중교통(또는 가까워 걸어서)으로 잼 — 아니면 직선 어림 (86)
export type AreaPerson = { id: string; nickname: string; isMe: boolean; minutes: number; return: number | null; exact?: boolean };
const r5 = (m: number) => Math.round(m / 5) * 5;

// 고르게 걸리는지 — 차이 10분 이하. 제목 · 공유 문구 · 막대를 이 한 곳 기준으로 (83, 기준이 갈라졌던 일)
export function isEven(people: AreaPerson[]): boolean {
  const mins = people.map((p) => p.minutes);
  return Math.max(...mins) - Math.min(...mins) <= 10;
}

// 약속 화면 시간 카드 제목 — 결론만, 숫자는 막대가 맡는다 (83 디자인 검토, 토스 정산 · 위밋플레이스)
export function timeHeadline(people: AreaPerson[]): string {
  if (people.length === 0) return "";
  const mins = people.map((p) => p.minutes);
  const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
  if (isEven(people)) return `모두 ${r5(avg)}분쯤 걸려요`;
  const far = people.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  if (people.length === 2) {
    const near = people.find((p) => p !== far)!;
    // 막대 숫자(5분 단위)끼리 뺀 값 — 제목과 막대가 어긋나지 않게
    const diff = r5(far.minutes) - r5(near.minutes);
    return far.isMe ? `내가 ${diff}분 더 걸려요` : `${far.nickname}님이 ${diff}분 더 걸려요`;
  }
  return far.isMe ? `내가 가장 멀어요, ${r5(far.minutes)}분쯤` : `가장 먼 ${far.nickname}님도 ${r5(far.minutes)}분쯤이에요`;
}

export function areaReason(people: AreaPerson[]): string {
  if (people.length === 0) return "";
  const mins = people.map((p) => p.minutes);
  const max = Math.max(...mins);
  const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
  if (isEven(people)) return `${people.length === 2 ? "두 사람" : `${people.length}명`} 모두 ${r5(avg)}분쯤`;
  const name = (p: AreaPerson) => (p.isMe ? "나" : `${p.nickname}님`);
  if (people.length === 2) {
    const [a, b] = [...people].sort((x, y) => Number(y.isMe) - Number(x.isMe));
    return `${name(a)} ${r5(a.minutes)}분쯤, ${name(b)} ${r5(b.minutes)}분쯤`;
  }
  const far = people.find((p) => p.minutes === max)!;
  return `가장 먼 ${name(far)} ${r5(max)}분쯤, 평균 ${r5(avg)}분`;
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

export type AreaScore = { name: string; lat: number; lng: number; people: AreaPerson[]; maxMinutes: number; avgMinutes: number; recent: number; station?: string | null };
export type RankedPerson = AreaPerson & { last: string | null; late: boolean };
export type RankedArea = Omit<AreaScore, "people"> & { people: RankedPerson[]; lateCount: number };

// 헤어지는 시각이 있으면 막차를 넘기는 사람이 적은 지역부터, 그다음 가장 먼 사람이 짧은 순 · 평균
export function rankAreas(areas: AreaScore[], endsAt: Date | null, limit = 3): RankedArea[] {
  const end = endsAt ? endMinutesKst(endsAt) : null;
  return areas
    .map((a) => {
      const people = a.people.map((p) => {
        const lastAt = p.return !== null ? lastDepartureMinutes(p.return) : null;
        return { ...p, last: lastAt !== null ? clock(lastAt) : null, late: end !== null && lastAt !== null && end > lastAt };
      });
      return { ...a, people, lateCount: people.filter((p) => p.late).length };
    })
    .sort((a, b) => a.lateCount - b.lateCount || a.maxMinutes - b.maxMinutes || a.avgMinutes - b.avgMinutes || b.recent - a.recent)
    .slice(0, limit);
}

// '23:50' · '00:20' 정렬용 — 새벽 0 ~ 4시는 자정 넘긴 막차로 더 늦게
export function lastOrder(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h < 4 ? h + 24 : h) * 60 + m;
}

// 이보다 일찍 끝나는 약속(점심 · 낮)에는 막차 줄을 띄우지 않는다 — 가장 이른 막차 어림(22:50)보다 두 시간 남짓 앞
const NIGHT_FROM = 21 * 60;

// 약속 화면 시간 카드의 막차 줄 (83 디자인 검토) — 끊기면 빨강 한 줄 + 근거, 아니면 가장 이른 막차 정보, 내 귀가지가 없으면 넣기로
export type LastTrainLine = { late: boolean; title: string | null; detail: string | null; askMine: boolean };
export function lastTrainLine(people: RankedPerson[], endsAt: Date | null): LastTrainLine | null {
  const byLast = (list: RankedPerson[]) => [...list].filter((p) => p.last).sort((a, b) => lastOrder(a.last!) - lastOrder(b.last!));
  const own = (p: RankedPerson) => (p.isMe ? "내" : `${p.nickname}님`);
  const askMine = people.some((p) => p.isMe && !p.last);
  const late = byLast(people.filter((p) => p.late));
  if (late.length > 0) {
    const who =
      late.length === people.length ? "모두" : late.length === 1 ? own(late[0]) : late.length <= 3 ? [...late].sort((a, b) => Number(b.isMe) - Number(a.isMe)).map((p) => (p.isMe ? "나" : `${p.nickname}님`)).join(", ") : `${own(late[0])} 외 ${late.length - 1}명`;
    const end = endsAt ? `, 약속 ${nightClock(clock(endMinutesKst(endsAt)))}까지` : "";
    return { late: true, title: `약속이 끝나기 전에 ${who} 막차가 끊겨요`, detail: `${own(late[0])} 막차 ${nightClock(late[0].last!)}${end}`, askMine };
  }
  if (endsAt && endMinutesKst(endsAt) < NIGHT_FROM) return null;
  const first = byLast(people)[0];
  if (!first && !askMine) return null;
  return {
    late: false,
    title: first ? `${nightClock(first.last!)}에는 나서야 해요` : null,
    detail: first ? (first.isMe ? "내 기준" : `${first.nickname}님 기준`) : null,
    askMine,
  };
}
