import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NICKNAME_SETUP } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 로그인 확인용 임시 홈 — 대시보드로 교체 예정
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-6 px-5 py-8">
      <Suspense fallback={<h1 className="text-title font-bold tracking-tight">반가워요</h1>}>
        <Greeting />
      </Suspense>
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

// 쿠키(세션)를 읽는 부분만 요청 시점에 그린다
async function Greeting() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("nickname, nickname_set_at").eq("id", userId).single()
    : { data: null };
  if (profile && !profile.nickname_set_at) redirect(`${NICKNAME_SETUP}?next=/home`);
  return <h1 className="text-title font-bold tracking-tight">{profile?.nickname ?? "MY"}님, 반가워요</h1>;
}
