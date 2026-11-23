// 외부 API(네이버 · 카카오) 호출 시간 제한 — 응답이 늦으면 크론(300초)이 통째로 잘리지 않게 한 건만 실패시킨다
export const EXTERNAL_TIMEOUT_MS = 10_000;

export const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(EXTERNAL_TIMEOUT_MS) });
