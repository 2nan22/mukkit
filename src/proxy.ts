import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicEnv } from "@/config/env";
import { isProtectedPath, NICKNAME_SETUP, ONBOARDED_COOKIE, SIGNED_IN_HOME, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { needsAgreement, TERMS_VERSION } from "@/features/legal/legal";

// 요청마다 세션을 갱신하고, 로그인 여부로 보호 경로를 가른다
export async function proxy(request: NextRequest) {
  const env = readPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!signedIn && isProtectedPath(pathname)) return redirectKeepingCookies(request, response, SIGNED_OUT_HOME);
  if (signedIn && pathname === SIGNED_OUT_HOME) return redirectKeepingCookies(request, response, SIGNED_IN_HOME);
  if (signedIn && isProtectedPath(pathname) && !pathname.startsWith("/onboarding")) {
    const mark = `${data!.claims.sub}:${TERMS_VERSION}`;
    if (request.cookies.get(ONBOARDED_COOKIE)?.value !== mark) {
      const step = await onboardingStep(supabase);
      const next = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      if (step === "nickname") return redirectKeepingCookies(request, response, NICKNAME_SETUP + next);
      if (step === "terms") return redirectKeepingCookies(request, response, "/onboarding/terms" + next);
      if (step === "done") response.cookies.set(ONBOARDED_COOKIE, mark, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    }
  }
  return response;
}

// 닉네임 · 약관을 마치기 전엔 어느 보호 화면에서든 그 단계로 — 홈에만 있던 확인을 한 곳으로 (계정이 없으면 화면이 처리)
async function onboardingStep(supabase: SupabaseClient): Promise<"nickname" | "terms" | "done" | "unknown"> {
  const { data, error } = await supabase.rpc("my_profile_flags").maybeSingle<{ nickname_set_at: string | null; terms_version: string | null }>();
  if (error || !data) return "unknown";
  if (!data.nickname_set_at) return "nickname";
  if (needsAgreement(data)) return "terms";
  return "done";
}

// 갱신된 세션 쿠키를 리다이렉트 응답에도 실어야 다음 요청에서 다시 갱신하지 않는다
function redirectKeepingCookies(request: NextRequest, from: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
