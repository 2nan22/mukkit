import type { PlaceSource, PlaceSourceName } from "@/domain/importedPlace";
import { KakaoFolderSource } from "./kakao/kakaoFolderSource";
import { NaverSharedListSource } from "./naver/naverSharedListSource";

const NAVER_HOSTS = ["naver.me", "map.naver.com", "m.map.naver.com"];
const KAKAO_HOSTS = ["map.kakao.com", "m.map.kakao.com", "kko.to", "kko.kakao.com"];

// 링크만 보고 출처를 고른다 — 모르면 null
export function sourceNameForLink(link: string): PlaceSourceName | null {
  const text = link.trim();
  if (/^[0-9a-f]{32}$/.test(text)) return "naver";
  if (/^\d{1,12}$/.test(text)) return "kakao";
  let host: string;
  try {
    host = new URL(text).hostname;
  } catch {
    return null;
  }
  if (NAVER_HOSTS.includes(host)) return "naver";
  if (KAKAO_HOSTS.includes(host)) return "kakao";
  return null;
}

export function placeSourceFor(name: PlaceSourceName): PlaceSource {
  return name === "naver" ? new NaverSharedListSource() : new KakaoFolderSource();
}

export const SOURCE_LABEL: Record<PlaceSourceName, string> = { naver: "네이버", kakao: "카카오" };
