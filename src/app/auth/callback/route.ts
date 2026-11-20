import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NICKNAME_SETUP, safeNextPath } from "@/features/auth/paths";

// 카카오 → Supabase → 여기로 돌아온 code 를 세션으로 바꾼다
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/?error=login", request.url));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/?error=login", request.url));

  // 닉네임을 아직 직접 정하지 않았으면 정하기 화면을 먼저 거친다
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname_set_at")
    .eq("id", data.user.id)
    .single();
  if (!profile?.nickname_set_at) {
    const setup = new URL(NICKNAME_SETUP, request.url);
    setup.searchParams.set("next", next);
    return NextResponse.redirect(setup);
  }
  return NextResponse.redirect(new URL(next, request.url));
}
