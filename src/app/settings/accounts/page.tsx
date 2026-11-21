import Link from "next/link";
import { WithdrawSection } from "@/features/auth/WithdrawSection";
import { PushToggle } from "@/features/push/PushToggle";
import { ProviderMark } from "@/components/brand/BrandLogo";
import { AppHeader } from "@/components/AppHeader";
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
      <AppHeader kind="back" fallback="/my" title="계정" />
      <p className="px-5 pb-4 text-meta leading-relaxed text-muted">
        로그인 방법을 연결하면 어느 것으로 로그인해도 같은 계정이에요.
      </p>
      <Suspense fallback={null}>
        <AccountLinks searchParams={searchParams} />
      </Suspense>
      <section className="px-5 pt-6">
        <PushToggle variant="row" />
      </section>
      <form action="/auth/logout" method="post" className="px-5 pt-4">
        <button type="submit" className="h-btn-m w-full rounded-btn-m bg-surface text-body font-medium text-ink">
          로그아웃
        </button>
      </form>
      <div className="flex-1" />
      <div className="flex flex-col gap-3 px-5 pt-10 pb-8">
        <div className="flex justify-center gap-4 text-meta text-muted">
          <Link href="/terms" className="underline underline-offset-2">
            이용약관
          </Link>
          <Link href="/privacy" className="underline underline-offset-2">
            개인정보 처리방침
          </Link>
        </div>
        <WithdrawSection />
      </div>
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
        <p role="alert" className="mb-3 rounded-btn-m bg-surface px-4 py-3 text-meta leading-relaxed text-danger">
          {message}
        </p>
      )}
      <ul className="flex flex-col">
        {LOGIN_PROVIDER_ORDER.map((provider) => (
          <li key={provider} className="flex min-h-16 items-center gap-3 border-b border-line">
            <ProviderMark provider={provider} />
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
              <a href={`/auth/link/${provider}`} className="flex h-9 items-center rounded-btn-s border border-line-strong bg-white px-3.5 text-meta font-semibold text-ink">
                연결하기
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

