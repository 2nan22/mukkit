import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { readPublicEnv } from "@/config/env";

// 서버 컴포넌트 · 서버 함수 · 라우트 핸들러용 — 요청마다 새로 만든다
export async function createSupabaseServerClient() {
  // 세션은 요청마다 다르다 — 미리 그리기(prerender)에서 빠지도록 먼저 요청 시점임을 알린다
  await connection();
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
