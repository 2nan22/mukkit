import { getMyProfileFlags } from "@/features/profile/flags";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACCOUNT_LINKS, NICKNAME_SETUP, safeNextPath, SIGNED_IN_HOME, ONBOARDING_CHARACTER, ONBOARDING_IMPORT } from "@/features/auth/paths";
import { isLoginProvider, LAST_LOGIN_COOKIE } from "@/features/auth/providers";

// 소셜 공급자 → Supabase → 여기로 돌아온 code 를 세션으로 바꾼다 (로그인 · 계정 연결 공용)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));
  const failed = (reason: string) => {
    // 계정 연결 중 실패는 설정 화면에서, 로그인 실패는 시작 화면에서 안내한다
    const target = next === ACCOUNT_LINKS ? new URL(ACCOUNT_LINKS, request.url) : new URL("/", request.url);
    target.searchParams.set("error", next === ACCOUNT_LINKS ? reason : "login");
    target.searchParams.set("from", "auth");
    return NextResponse.redirect(target);
  };

  if (!code) return failed(params.get("error_code") ?? params.get("error") ?? "missing_code");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failed(error.code ?? "exchange_failed");

  // 로그인이 성공한 방법을 이 기기에 기억 — 시작 화면에서 '최근 로그인' 으로 보여 준다
  const via = params.get("via");
  const remember = (res: NextResponse) => {
    if (via && isLoginProvider(via)) res.cookies.set(LAST_LOGIN_COOKIE, via, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  };

  // 닉네임을 아직 직접 정하지 않았으면 정하기 화면을 먼저 거친다
  const profile = await getMyProfileFlags(supabase);
  if (!profile?.nickname_set_at) {
    const setup = new URL(NICKNAME_SETUP, request.url);
    // 처음 가입이면 닉네임 다음에 캐릭터 고르기 → '저장해 둔 맛집 가져오기'(둘 다 건너뛰기 가능)
    setup.searchParams.set("next", next === SIGNED_IN_HOME ? `${ONBOARDING_CHARACTER}?next=${encodeURIComponent(ONBOARDING_IMPORT)}` : next);
    setup.searchParams.set("from", "auth");
    return remember(NextResponse.redirect(setup));
  }
  // 외부 로그인 페이지를 거쳐 왔다는 표시 — 앱이 여기서 기록을 새로 시작한다 (lib/nav/NavTracker)
  const target = new URL(next, request.url);
  target.searchParams.set("from", "auth");
  return remember(NextResponse.redirect(target));
}
