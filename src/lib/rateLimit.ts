import "server-only";

// 사용자별 짧은 구간 호출 수 제한 — 서버 인스턴스 하나 안에서만 세는 간이 방어(연타 · 반복 스크립트로 원본 API 가 막히지 않게)
const hits = new Map<string, number[]>();

export function allowCall(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return true;
}
