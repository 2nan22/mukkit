// 약속 시간 표기 (67) — '내일 25일(수) 저녁 7:00 ~ 9:30'. 오전 · 오후 대신 하루 때(점심 · 저녁 · 밤)로, 같은 때면 끝은 시각만
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const NEAR = ["오늘", "내일", "모레"];
const KST = 9 * 3600_000;

// 하루 중 때 — 분(0 ~ 1439, 자정 넘긴 새벽은 24시 이후로 와도 됨)
export function partOfDay(minutes: number): string {
  // 자정 정각에 끝나는 약속은 '밤 12:00'
  if (minutes === 24 * 60) return "밤";
  const m = minutes % (24 * 60);
  if (m < 6 * 60) return "새벽";
  if (m < 11 * 60) return "오전";
  if (m < 15 * 60) return "점심";
  if (m < 17 * 60) return "오후";
  if (m < 22 * 60) return "저녁";
  return "밤";
}

export function clock(minutes: number): string {
  const m = minutes % (24 * 60);
  const h = Math.floor(m / 60) % 12 || 12;
  return `${h}:${String(m % 60).padStart(2, "0")}`;
}

// 시간대 + 시각 범위 — '저녁 7:00 ~ 9:30' · '저녁 8:00 ~ 밤 11:00'
export function timeRange(start: number, end: number): string {
  const a = partOfDay(start);
  const b = partOfDay(end);
  return `${a} ${clock(start)} ~ ${b === a ? "" : `${b} `}${clock(end)}`;
}

// 날짜 — 사흘 안이면 '내일 25일(수)', 그 밖은 '11월 27일(금)'
export function dayWord(kstDate: Date, todayKst: Date): string {
  const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  const diff = day(kstDate) - day(todayKst);
  const tail = `${kstDate.getUTCDate()}일(${WEEK[kstDate.getUTCDay()]})`;
  return diff >= 0 && diff < NEAR.length ? `${NEAR[diff]} ${tail}` : `${kstDate.getUTCMonth() + 1}월 ${tail}`;
}

// 저장된 약속 시각(ISO) → 화면 표기
export function meetWhen(startsAt: string | null, endsAt: string | null, now = Date.now()): string {
  if (!startsAt) return "시간 미정";
  const s = new Date(new Date(startsAt).getTime() + KST);
  const mins = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
  const start = mins(s);
  const head = dayWord(s, new Date(now + KST));
  if (!endsAt) return `${head} ${partOfDay(start)} ${clock(start)}`;
  const e = new Date(new Date(endsAt).getTime() + KST);
  // 자정을 넘기면 끝 시각을 24시 뒤로 — '밤 11:00 ~ 새벽 1:00'
  const end = mins(e) + (e.getUTCDate() !== s.getUTCDate() ? 24 * 60 : 0);
  return `${head} ${timeRange(start, end)}`;
}
