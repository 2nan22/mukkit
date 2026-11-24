import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { WithdrawSection } from "@/features/auth/WithdrawSection";
import { getImportSources } from "@/features/import/importSources";
import { CONTACT_EMAIL } from "@/features/legal/legal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "설정" };

// 설정 (42) — 한 화면에 섞여 있던 것을 항목별 화면으로 나눔. 로그아웃 · 탈퇴는 맨 아래
export default function SettingsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/my" title="설정" />
      <Group title="계정">
        <Row href="/settings/accounts" label="로그인 연결" />
      </Group>
      <Group title="알림">
        <Row href="/settings/notifications" label="알림 받기" />
      </Group>
      <Group title="가져오기">
        <Suspense fallback={<Row href="/import/sources" label="가져온 원본 관리" />}>
          <SourcesRow />
        </Suspense>
      </Group>
      <Group title="차단">
        <Row href="/settings/blocked" label="차단한 사람" />
      </Group>
      <Group title="정보">
        <Row href="/terms" label="이용약관" />
        <Row href="/privacy" label="개인정보 처리방침" />
        {CONTACT_EMAIL && <Row href={`mailto:${CONTACT_EMAIL}`} label="문의하기" />}
        <div className="flex min-h-14 items-center justify-between border-b border-line text-body">
          버전
          <span className="text-meta text-muted">
            {process.env.NEXT_PUBLIC_APP_VERSION} ({process.env.NEXT_PUBLIC_APP_BUILD})
          </span>
        </div>
      </Group>
      <div className="flex-1" />
      <div className="flex flex-col items-center gap-3 px-5 pt-10 pb-8">
        <form action="/auth/logout" method="post">
          <button type="submit" className="h-11 px-3 text-meta text-muted">
            로그아웃
          </button>
        </form>
        <WithdrawSection />
      </div>
    </main>
  );
}

async function SourcesRow() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const rows = await getImportSources(supabase, me);
  return <Row href="/import/sources" label="가져온 원본 관리" value={rows.length > 0 ? `${rows.length}개` : undefined} />;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col px-5 pt-5">
      <h2 className="pb-1 text-meta text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Row({ href, label, value }: { href: string; label: string; value?: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-2 border-b border-line text-body">
      <span className="flex-1">{label}</span>
      {value && <span className="text-meta text-muted">{value}</span>}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-subtle" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
