// .in() 은 id 를 주소(GET)에 싣는다 — 수백 개면 주소가 길어져 요청이 실패하므로 200개씩 나눈다
export const IN_CHUNK = 200;

type Result<T> = PromiseLike<{ data: T[] | null; error: { code?: string } | null }>;

export function chunks<T>(items: readonly T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// 나눠 읽고 합친다 — 한 묶음이라도 실패하면 그 오류를 돌려준다(조용히 줄어든 결과를 내지 않게)
export async function selectInChunks<T, K>(ids: readonly K[], query: (part: K[]) => Result<T>): Promise<{ data: T[]; error: { code?: string } | null }> {
  const out: T[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await query(part);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
  }
  return { data: out, error: null };
}
