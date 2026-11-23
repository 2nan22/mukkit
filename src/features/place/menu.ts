import { cacheLife } from "next/cache";
import { z } from "zod";
import { isSamePlace } from "@/domain/samePlace";
import { KAKAO_FOLDER } from "@/features/import/kakao/config";
import { NAVER_PLACE } from "@/features/import/naver/config";

// 메뉴는 카카오맵 장소 정보가 먼저, 없으면 네이버 지도(차선책) — 열 때만 읽고 하루 동안 캐시, 사진은 쓰지 않는다
// 화면에 출처(어느 지도 기준인지)와 원문 링크를 함께 보여 준다
export type MenuItem = { name: string; price: number | null; description: string; recommended: boolean };
export type MenuSource = "kakao" | "naver";
export type Menu = { items: MenuItem[]; updatedAt: string | null; source: MenuSource; url: string };

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

type Target = { name: string; lat: number; lng: number; kakaoPlaceId: string | null; naverPlaceId?: string | null };

export async function getMenu(target: Target): Promise<Menu | null> {
  "use cache";
  cacheLife("days");
  const kakao = await getKakaoMenu(target);
  if (kakao) return kakao;
  return target.naverPlaceId ? getNaverMenu(target.naverPlaceId) : null;
}

async function getKakaoMenu(target: Target): Promise<Menu | null> {
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
  return { items, updatedAt: menus?.items_updated_at ?? null, source: "kakao", url: `https://place.map.kakao.com/${kakaoPlaceId}` };
}

const NaverMenuItemSchema = z.object({
  __typename: z.literal("PlaceMenuItem"),
  name: z.string(),
  description: z.string().nullable().optional(),
  badges: z.array(z.string()).nullable().optional(),
  price: z.object({ displayText: z.string().nullable().optional() }).nullable().optional(),
});

// 네이버 모바일 장소 페이지의 데이터 묶음(__APOLLO_STATE__)에서 메뉴 항목만
export function parseNaverMenu(html: string): MenuItem[] {
  const m = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});\s*window\./);
  if (!m) return [];
  let state: unknown;
  try {
    state = JSON.parse(m[1]);
  } catch {
    return [];
  }
  if (!state || typeof state !== "object") return [];
  return Object.values(state).flatMap((v) => {
    const p = NaverMenuItemSchema.safeParse(v);
    if (!p.success || !p.data.name.trim()) return [];
    const digits = (p.data.price?.displayText ?? "").replace(/[^0-9]/g, "");
    const price = digits ? Number(digits) : 0;
    return [{ name: p.data.name.trim(), price: price > 0 ? price : null, description: p.data.description?.trim() ?? "", recommended: (p.data.badges ?? []).includes("repr") }];
  });
}

async function getNaverMenu(naverPlaceId: string): Promise<Menu | null> {
  if (!/^\d+$/.test(naverPlaceId)) return null;
  const res = await fetch(NAVER_PLACE.menuUrl(naverPlaceId), { headers: NAVER_PLACE.headers }).catch(() => null);
  if (!res?.ok) return null;
  const items = parseNaverMenu(await res.text().catch(() => ""));
  return items.length ? { items, updatedAt: null, source: "naver", url: NAVER_PLACE.pageUrl(naverPlaceId) } : null;
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
