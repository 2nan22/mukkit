import { createSupabaseServerClient } from "@/lib/supabase/server";

// 로그인 확인용 임시 홈 — 대시보드는 다음 세션에서
export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("nickname").eq("id", userId).single()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-title font-bold tracking-tight">{profile?.nickname ?? "MY"}님, 반가워요</h1>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="h-btn-m w-full rounded-btn-m border border-line-strong text-body text-ink"
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}
