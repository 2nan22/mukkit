// Supabase(PostgREST)는 한 번에 max_rows(1000)행까지만 돌려준다 — .limit() 을 크게 줘도 잘린다 (55)
// 1000행씩 나눠 끝까지 받는다. page 는 반드시 정렬을 고정해 줘야 쪽이 겹치거나 빠지지 않는다
type Page<T> = PromiseLike<{ data: T[] | null; error: { code?: string } | null }>;

export const PAGE_SIZE = 1000;

export async function fetchAll<T>(page: (from: number, to: number) => Page<T>, max = 20000): Promise<{ data: T[]; error: { code?: string } | null }> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: out, error: null };
}
