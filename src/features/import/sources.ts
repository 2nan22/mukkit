import type { PlaceSource, PlaceSourceName } from "@/domain/importedPlace";
import { KakaoFolderSource } from "./kakao/kakaoFolderSource";
import { NaverSharedListSource } from "./naver/naverSharedListSource";

const NAVER_HOSTS = ["naver.me", "map.naver.com", "m.map.naver.com"];
const KAKAO_HOSTS = ["map.kakao.com", "m.map.kakao.com", "kko.to", "kko.kakao.com"];

// 링크만 보고 출처를 고른다 — 모르면 null
// 폰 앱의 '공유 · 복사'는 '[네이버지도] 리스트 이름 https://naver.me/…' 처럼 글이 섞여 온다 — 첫 링크만 쓴다
export function extractLink(input: string): string {
  const url = input.match(/https?:\/\/[^\s<>"']+/);
  return (url ? url[0] : input).trim();
}

export function sourceNameForLink(link: string): PlaceSourceName | null {
  const text = extractLink(link);
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
