// 카카오맵 대중교통 경로 응답 해석 (86) — 여러 경로 중 가장 빠른 것의 분
// 'none' = 경로 없음(다시 부르지 않음), null = 알 수 없는 응답(다음에 다시)
export type TransitResult = { status: "ok"; minutes: number } | { status: "none" };

const NO_ROUTE = new Set(["NO_RESULTS", "STARTNODES_NULL", "ENDNODES_NULL", "EQUAL_POINTS"]);

type Body = { status?: string; routes?: { properties?: { totalTime?: number } }[] };

export function parseTransit(body: unknown): TransitResult | null {
  const b = body as Body;
  if (!b || typeof b.status !== "string") return null;
  if (NO_ROUTE.has(b.status)) return { status: "none" };
  if (b.status !== "OK") return null;
  const times = (b.routes ?? []).map((r) => r.properties?.totalTime).filter((t): t is number => typeof t === "number" && t > 0);
  if (times.length === 0) return { status: "none" };
  return { status: "ok", minutes: Math.max(1, Math.round(Math.min(...times) / 60)) };
}
