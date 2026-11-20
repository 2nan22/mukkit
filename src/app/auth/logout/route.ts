import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";

// 폼 POST 로만 받는다 — GET 이면 링크 미리보기 · 프리페치만으로 로그아웃될 수 있다
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(SIGNED_OUT_HOME, request.url), { status: 303 });
}
