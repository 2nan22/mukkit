import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { unlinkProvider } from "@/features/auth/linkActions";
import { identityLabel } from "@/features/auth/identityLabel";
import { linkErrorMessage } from "@/features/auth/linkErrors";
import { fromSupabaseProvider, LOGIN_PROVIDER_LABEL, LOGIN_PROVIDER_ORDER } from "@/features/auth/providers";

export default function AccountLinksPage({ searchParams }: PageProps<"/settings/accounts">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="grid h-14 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/home" aria-label="뒤로 가기" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">로그인 연결</h1>
      </header>
      <p className="px-5 pb-4 text-meta leading-relaxed text-muted">
        연결해 두면 어느 방법으로 로그인해도 같은 계정으로 들어와요.
      </p>
      <Suspense fallback={null}>
        <AccountLinks searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// 세션 · 쿼리를 읽는 부분만 요청 시점에 그린다
async function AccountLinks({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  const message = linkErrorMessage(typeof error === "string" ? error : undefined);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUserIdentities();
  if (!data) redirect(SIGNED_OUT_HOME);

  const linked = new Map(data.identities.map((identity) => [fromSupabaseProvider(identity.provider), identity]));
  const canUnlink = data.identities.length > 1;

  return (
    <section className="flex flex-col px-5">
      {message && (
        <p role="alert" className="mb-3 rounded-btn-m bg-surface px-4 py-3 text-meta leading-relaxed text-[#c4320a]">
          {message}
        </p>
      )}
      <ul className="flex flex-col">
        {LOGIN_PROVIDER_ORDER.map((provider) => (
          <li key={provider} className="flex min-h-16 items-center gap-3 border-b border-line">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-body font-bold">{LOGIN_PROVIDER_LABEL[provider]}</span>
              <span className="text-meta text-muted">
                {linked.has(provider) ? identityLabel(linked.get(provider)!) : "연결 안 됨"}
              </span>
            </span>
            {linked.has(provider) ? (
              canUnlink && (
                <form action={unlinkProvider}>
                  <input type="hidden" name="provider" value={provider} />
                  <button type="submit" className="h-btn-m rounded-btn-m border border-line-strong px-4 text-meta text-ink-2">
                    연결 해제
                  </button>
                </form>
              )
            ) : (
              <a href={`/auth/link/${provider}`} className="flex h-btn-m items-center rounded-btn-m bg-ink px-4 text-meta font-bold text-white">
                연결하기
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
