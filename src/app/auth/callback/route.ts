import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACCOUNT_LINKS, NICKNAME_SETUP, safeNextPath } from "@/features/auth/paths";

// 소셜 공급자 → Supabase → 여기로 돌아온 code 를 세션으로 바꾼다 (로그인 · 계정 연결 공용)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));
  const failed = (reason: string) => {
    // 계정 연결 중 실패는 설정 화면에서, 로그인 실패는 시작 화면에서 안내한다
    const target = next === ACCOUNT_LINKS ? new URL(ACCOUNT_LINKS, request.url) : new URL("/", request.url);
    target.searchParams.set("error", next === ACCOUNT_LINKS ? reason : "login");
    return NextResponse.redirect(target);
  };

  if (!code) return failed(params.get("error_code") ?? params.get("error") ?? "missing_code");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failed(error.code ?? "exchange_failed");

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
