import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicEnv } from "@/config/env";

// 서버 컴포넌트 · 서버 함수 · 라우트 핸들러용 — 요청마다 새로 만든다
export async function createSupabaseServerClient() {
  const env = readPublicEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 못 쓴다 — 세션 갱신은 proxy 가 맡는다
        }
      },
    },
  });
}
