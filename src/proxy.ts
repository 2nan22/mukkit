import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicEnv } from "@/config/env";
import { isProtectedPath, SIGNED_IN_HOME, SIGNED_OUT_HOME } from "@/features/auth/paths";

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
  return response;
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
