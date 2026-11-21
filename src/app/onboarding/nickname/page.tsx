import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { NicknameForm } from "@/features/profile/NicknameForm";
import { suggestNickname } from "@/features/profile/nickname";

export default function NicknamePage({ searchParams }: PageProps<"/onboarding/nickname">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-5 pt-10">
      <div className="flex flex-col gap-2 pb-8">
        <h1 className="text-title font-bold leading-snug tracking-tight">
          다른 사람에게 보일
          <br />
          닉네임을 정해주세요
        </h1>
        <p className="text-body text-ink-2">평가와 리스트에 이 이름이 표시돼요. 나중에 바꿀 수 있어요.</p>
        <p className="pt-2 text-meta leading-relaxed text-muted">
          이미 가입했다면 그때 쓴 방법으로 로그인해 주세요.
        </p>
      </div>
      <Suspense fallback={null}>
        <NicknameFormLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// 세션 · 쿼리를 읽는 부분만 요청 시점에 그린다
async function NicknameFormLoader({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);

  const { data: profile } = await supabase.from("profiles").select("nickname_set_at").eq("id", userId).single();
  if (profile?.nickname_set_at) redirect(nextPath);

  const metadata = data.claims.user_metadata as Record<string, unknown> | undefined;
  return <NicknameForm suggestion={suggestNickname(metadata)} next={nextPath} />;
}
