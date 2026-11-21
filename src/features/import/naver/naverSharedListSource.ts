import { z } from "zod";
import {
  ImportError,
  type ImportedList,
  type ImportedPlace,
  type PlaceSource,
} from "@/domain/importedPlace";
import { NAVER_SHARED_LIST } from "./config";
import { naverCuisineOf } from "./naverCuisine";

type FetchLike = typeof fetch;

const SHARE_ID = /^[0-9a-f]{32}$/;
const FOLDER_PATH = /\/folder\/([0-9a-f]{32})(?:[/?#]|$)/;

const BookmarkSchema = z.object({
  sid: z.string().min(1),
  name: z.string().min(1),
  px: z.number(),
  py: z.number(),
  address: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  mcidName: z.string().nullable().optional(),
  cidPath: z.array(z.string()).nullable().optional(),
  creationTime: z.number(),
  available: z.boolean().optional(),
});

const ResponseSchema = z.object({
  folder: z.object({
    name: z.string(),
    memo: z.string().nullable().optional(),
    bookmarkCount: z.number(),
  }),
  bookmarkList: z.array(z.unknown()),
});

const ErrorBodySchema = z.object({ apiErrorCode: z.union([z.number(), z.string()]) });

export class NaverSharedListSource implements PlaceSource {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchList(input: string): Promise<ImportedList> {
    const shareId = await this.resolveShareId(input.trim());
    const res = await this.fetchImpl(NAVER_SHARED_LIST.bookmarksUrl(shareId), {
      headers: NAVER_SHARED_LIST.headers,
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw toUpstreamError(res.status, body);

    const parsed = ResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new ImportError("UNEXPECTED_RESPONSE", "네이버 응답 형식이 예상과 다릅니다", {
        httpStatus: res.status,
      });
    }
    return toImportedList(shareId, parsed.data);
  }

  async resolveShareId(input: string): Promise<string> {
    if (SHARE_ID.test(input)) return input;
    const url = parseUrl(input);
    if (url.hostname === NAVER_SHARED_LIST.shortLinkHost) {
      const res = await this.fetchImpl(url, {
        redirect: "manual",
        headers: NAVER_SHARED_LIST.headers,
      });
      const location = res.headers.get("location");
      if (!location) throw new ImportError("INVALID_LINK", "단축 링크가 리스트로 연결되지 않습니다");
      return extractFolderId(location);
    }
    return extractFolderId(url.toString());
  }
}

function parseUrl(input: string): URL {
  try {
    return new URL(input);
  } catch {
    throw new ImportError("INVALID_LINK", "네이버 지도 리스트의 공유 링크가 아닙니다");
  }
}

function extractFolderId(url: string): string {
  const match = FOLDER_PATH.exec(new URL(url).pathname);
  if (!match) throw new ImportError("INVALID_LINK", "네이버 지도 리스트의 공유 링크가 아닙니다");
  return match[1];
}

function toUpstreamError(status: number, body: unknown): ImportError {
  const parsed = ErrorBodySchema.safeParse(body);
  const upstreamCode = parsed.success ? parsed.data.apiErrorCode : undefined;
  if (Number(upstreamCode) === NAVER_SHARED_LIST.notSharedApiErrorCode) {
    return new ImportError("LIST_NOT_FOUND_OR_PRIVATE", "없거나 비공개인 리스트입니다", {
      httpStatus: status,
      upstreamCode,
    });
  }
  return new ImportError("UPSTREAM_ERROR", "네이버 지도에서 리스트를 불러오지 못했습니다", {
    httpStatus: status,
    upstreamCode,
  });
}

function toImportedList(
  shareId: string,
  data: z.infer<typeof ResponseSchema>,
): ImportedList {
  const places: ImportedPlace[] = [];
  const skipped: ImportedList["skipped"] = [];

  data.bookmarkList.forEach((raw, index) => {
    const item = BookmarkSchema.safeParse(raw);
    if (!item.success) {
      skipped.push({ index, reason: item.error.issues[0]?.message ?? "형식 오류" });
      return;
    }
    const b = item.data;
    // 네이버가 코드 묶음을 쉼표 한 덩어리로 줄 때가 있다
    const categoryPath = (b.cidPath ?? []).flatMap((code) => code.split(","));
    places.push({
      source: "naver",
      sourcePlaceId: b.sid,
      name: b.name,
      lat: b.py,
      lng: b.px,
      address: b.address ?? "",
      categoryPath,
      cuisine: naverCuisineOf(categoryPath).cuisine,
      categoryName: b.mcidName ?? "",
      memo: b.memo ?? "",
      savedAt: new Date(b.creationTime),
      available: b.available ?? true,
      raw,
    });
  });

  return {
    source: "naver",
    sourceListId: shareId,
    name: data.folder.name,
    memo: data.folder.memo ?? "",
    places,
    expectedCount: data.folder.bookmarkCount,
    skipped,
  };
}
