import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 로그인 토큰은 살아 있는데 계정(프로필)이 없는 경우 — 다른 기기에서 탈퇴했거나 운영자가 지운 계정
// 화면이 되돌아가는 반복 대신 로그아웃시키고 시작 화면에서 다시 로그인하게 한다
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/?error=session", request.url), { status: 303 });
}
