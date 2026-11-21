import { cacheLife } from "next/cache";
import { z } from "zod";
import { isSamePlace } from "@/domain/samePlace";
import { KAKAO_FOLDER } from "@/features/import/kakao/config";

// 메뉴는 카카오맵 장소 정보 기준 — 열 때만 읽고 하루 동안 캐시, 사진은 쓰지 않는다
export type MenuItem = { name: string; price: number | null; description: string; recommended: boolean };
export type Menu = { items: MenuItem[]; updatedAt: string | null; kakaoPlaceId: string };

const MenuSchema = z.object({
  menu: z
    .object({
      menus: z
        .object({
          items: z
            .array(
              z.object({
                name: z.string(),
                price: z.number().nullable().optional(),
                desc: z.string().nullable().optional(),
                is_recommend: z.boolean().nullable().optional(),
              }),
            )
            .nullable()
            .optional(),
          items_updated_at: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

const SearchSchema = z.object({
  documents: z.array(z.object({ id: z.string(), place_name: z.string(), x: z.string(), y: z.string() })),
});

type Target = { name: string; lat: number; lng: number; kakaoPlaceId: string | null };

export async function getMenu(target: Target): Promise<Menu | null> {
  "use cache";
  cacheLife("days");
  const kakaoPlaceId = target.kakaoPlaceId ?? (await findKakaoPlaceId(target));
  if (!kakaoPlaceId) return null;
  const res = await fetch(KAKAO_FOLDER.placeUrl(kakaoPlaceId), { headers: KAKAO_FOLDER.placeHeaders }).catch(() => null);
  if (!res?.ok) return null;
  const parsed = MenuSchema.safeParse(await res.json().catch(() => null));
  const menus = parsed.success ? parsed.data.menu?.menus : undefined;
  const items = (menus?.items ?? []).map((i) => ({
    name: i.name.trim(),
    price: typeof i.price === "number" && i.price > 0 ? i.price : null,
    description: i.desc?.trim() ?? "",
    recommended: Boolean(i.is_recommend),
  }));
  if (items.length === 0) return null;
  return { items, updatedAt: menus?.items_updated_at ?? null, kakaoPlaceId };
}

// 네이버에서만 가져온 가게 — 카카오 로컬 검색(공식 API)으로 이름 · 위치가 맞는 장소를 찾는다
async function findKakaoPlaceId(t: Target): Promise<string | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return null;
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(t.name)}&x=${t.lng}&y=${t.lat}&radius=300&size=5`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } }).catch(() => null);
  if (!res?.ok) return null;
  const parsed = SearchSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return null;
  const hit = parsed.data.documents.find((d) => isSamePlace(t, { name: d.place_name, lat: Number(d.y), lng: Number(d.x) }));
  return hit?.id ?? null;
}
