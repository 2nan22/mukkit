import { z } from "zod";
import {
  ImportError,
  type ImportedList,
  type ImportedPlace,
  type PlaceSource,
} from "@/domain/importedPlace";
import { KAKAO_FOLDER } from "./config";
import { wcongToLatLng } from "./kakaoCoords";
import { kakaoCuisineOf } from "./kakaoCuisine";

type FetchLike = typeof fetch;

const FOLDER_ID = /^\d{1,12}$/;
const MAX_REDIRECTS = 3;

const FolderInfoSchema = z.object({
  status: z.object({ code: z.string() }).optional(),
  folders: z
    .array(
      z.object({
        title: z.string(),
        memo: z.string().nullable().optional(),
        status: z.string(),
        favorite_cnt: z.number(),
      }),
    )
    .optional(),
});

const FavoriteSchema = z.looseObject({
  type: z.string(),
  display1: z.string().min(1),
  display2: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  key: z.string().min(1),
  x: z.number(),
  y: z.number(),
  created_at: z.string(),
});

const FavoritesSchema = z.object({ favorites: z.array(z.unknown()) });

const PlaceSummarySchema = z.object({
  summary: z.object({
    category: z
      .object({ name1: z.string().optional(), name2: z.string().optional(), name3: z.string().optional() })
      .optional(),
    point: z.object({ lat: z.number(), lon: z.number() }),
  }),
});

type Favorite = z.infer<typeof FavoriteSchema>;

export class KakaoFolderSource implements PlaceSource {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchList(input: string, opts: { knownIds?: ReadonlySet<string> } = {}): Promise<ImportedList> {
    const folderId = await this.resolveFolderId(input.trim());
    const folder = await this.fetchFolder(folderId);
    const raw = await this.getJson(KAKAO_FOLDER.favoritesUrl(folderId), KAKAO_FOLDER.headers);
    const parsed = FavoritesSchema.safeParse(raw);
    if (!parsed.success) throw new ImportError("UNEXPECTED_RESPONSE", "카카오맵 응답 형식이 예상과 다릅니다");

    const skipped: ImportedList["skipped"] = [];
    const favorites: Favorite[] = [];
    parsed.data.favorites.forEach((item, index) => {
      const fav = FavoriteSchema.safeParse(item);
      if (fav.success) favorites.push(fav.data);
      else skipped.push({ index, reason: fav.error.issues[0]?.message ?? "형식 오류" });
    });

    return {
      source: "kakao",
      sourceListId: folderId,
      name: folder.title,
      memo: folder.memo ?? "",
      places: await mapLimit(favorites, KAKAO_FOLDER.placeConcurrency, (f) => this.toPlace(f, opts.knownIds?.has(f.key) ?? false)),
      expectedCount: folder.favorite_cnt,
      skipped,
    };
  }

  async resolveFolderId(input: string): Promise<string> {
    if (FOLDER_ID.test(input)) return input;
    let url = parseUrl(input);
    for (let hop = 0; hop < MAX_REDIRECTS && isShortLink(url); hop++) {
      const res = await this.fetchImpl(url, { redirect: "manual", headers: KAKAO_FOLDER.headers });
      const location = res.headers.get("location");
      if (!location) throw new ImportError("INVALID_LINK", "단축 링크가 폴더로 연결되지 않습니다");
      url = new URL(location, url);
    }
    const folderId = url.hostname === KAKAO_FOLDER.mapHost ? url.searchParams.get("folderid") : null;
    if (!folderId || !FOLDER_ID.test(folderId)) {
      throw new ImportError("INVALID_LINK", "카카오맵 즐겨찾기 폴더의 공유 링크가 아닙니다");
    }
    return folderId;
  }

  private async fetchFolder(folderId: string) {
    const parsed = FolderInfoSchema.safeParse(await this.getJson(KAKAO_FOLDER.folderInfoUrl(folderId), KAKAO_FOLDER.headers));
    if (!parsed.success) throw new ImportError("UNEXPECTED_RESPONSE", "카카오맵 응답 형식이 예상과 다릅니다");
    const folder = parsed.data.folders?.[0];
    if (!folder || folder.status !== KAKAO_FOLDER.openStatus) {
      throw new ImportError("LIST_NOT_FOUND_OR_PRIVATE", "없거나 비공개인 폴더입니다", {
        upstreamCode: parsed.data.status?.code,
      });
    }
    return folder;
  }

  // 장소는 상세에서 위경도 · 업종을 받는다. 상세가 없으면(폐업 등) 즐겨찾기 좌표로
  // known: 이미 가져온 곳 — 상세를 다시 부르지 않는다 (새로 고침은 메모 · 목록만 본다)
  private async toPlace(f: Favorite, known = false): Promise<ImportedPlace> {
    const detail = f.type === "PLACE" && !known ? await this.fetchPlaceDetail(f.key) : null;
    const category = detail?.category;
    const categoryPath = [category?.name1, category?.name2, category?.name3].filter((v): v is string => !!v);
    const point = detail ? { lat: detail.point.lat, lng: detail.point.lon } : wcongToLatLng(f.x, f.y);
    return {
      source: "kakao",
      sourcePlaceId: f.key,
      name: f.display1,
      lat: point.lat,
      lng: point.lng,
      address: f.display2 ?? "",
      categoryPath,
      categoryName: category?.name3 ?? category?.name2 ?? "",
      cuisine: kakaoCuisineOf(categoryPath).cuisine,
      memo: f.memo ?? "",
      savedAt: parseKst(f.created_at),
      available: known || f.type !== "PLACE" || detail !== null,
      raw: { favorite: f, category: category ?? null },
    };
  }

  private async fetchPlaceDetail(placeId: string) {
    const res = await this.fetchImpl(KAKAO_FOLDER.placeUrl(placeId), { headers: KAKAO_FOLDER.placeHeaders });
    if (!res.ok) return null;
    const parsed = PlaceSummarySchema.safeParse(await res.json().catch(() => null));
    return parsed.success ? parsed.data.summary : null;
  }

  private async getJson(url: string, headers: Record<string, string>): Promise<unknown> {
    const res = await this.fetchImpl(url, { headers });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ImportError("UPSTREAM_ERROR", "카카오맵에서 폴더를 불러오지 못했습니다", { httpStatus: res.status });
    }
    return body;
  }
}

function parseUrl(input: string): URL {
  try {
    return new URL(input);
  } catch {
    throw new ImportError("INVALID_LINK", "카카오맵 즐겨찾기 폴더의 공유 링크가 아닙니다");
  }
}

function isShortLink(url: URL): boolean {
  return (KAKAO_FOLDER.shortLinkHosts as readonly string[]).includes(url.hostname);
}

// "2025-02-26 18:42:27" — 카카오는 한국 시간으로 준다
function parseKst(value: string): Date {
  return new Date(`${value.replace(" ", "T")}+09:00`);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
