// 피드 '여기까지 새 평가' 구분선 (70-3) — 기준(지난번 피드를 연 때)보다 오래된 첫 카드 자리. 없으면 -1
// Postgres 시각(소수점 6자리 · 공백 · +00)을 옛 Safari 도 읽게 ms 까지로 맞춘다
export function parseTime(s: string): number {
  return Date.parse(s.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d{2})$/, "$1:00"));
}

export function dividerIndex(items: { updatedAt: string }[], seenAt: string | null): number {
  if (!seenAt) return -1;
  const seen = parseTime(seenAt);
  return items.findIndex((r) => parseTime(r.updatedAt) <= seen);
}

// 구분선 위가 모두 내 평가면 '새 평가는 다 봤어요' — 내가 매긴 평가는 새 평가로 치지 않는다
export function nothingNew(items: { ownerId: string }[], index: number, me: string): boolean {
  return items.slice(0, index).every((r) => r.ownerId === me);
}
