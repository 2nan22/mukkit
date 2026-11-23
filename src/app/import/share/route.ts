import { NextResponse, type NextRequest } from "next/server";
import { extractLink, sourceNameForLink } from "@/features/import/sources";

// 홈 화면에 추가한 먹킷이 폰 공유 시트에 뜬다(manifest share_target) — 네이버 · 카카오 앱에서 공유 › 먹킷을 누르면 여기로
// 공유 문구(제목 · 글 · 주소)에서 리스트 링크를 찾아 가져오기 화면으로 넘긴다. 링크가 아니면 빈 가져오기 화면
export function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const shared = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
  const link = extractLink(shared);
  const target = new URL("/import", request.url);
  if (sourceNameForLink(link)) target.searchParams.set("link", link);
  return NextResponse.redirect(target);
}
