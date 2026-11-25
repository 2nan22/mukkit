// 피드 '여기까지 새 평가' 구분선 (70-3) — 기준(지난번 피드를 연 때)보다 오래된 첫 카드 자리. 없으면 -1
export function dividerIndex(items: { updatedAt: string }[], seenAt: string | null): number {
  if (!seenAt) return -1;
  const seen = Date.parse(seenAt);
  return items.findIndex((r) => Date.parse(r.updatedAt) <= seen);
}
