import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SourceMark } from "@/components/brand/BrandLogo";
import { ImportFlow } from "@/features/import/ImportFlow";
import { TEXT_IMPORT_ENABLED } from "@/features/textImport/enabled";

export const metadata = { title: "가져오기" };

export default function ImportPage({ searchParams }: PageProps<"/import">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="close" fallback="/home" title="저장한 장소 가져오기" />
      <Suspense fallback={<ImportFlow />}>
        <SharedLink searchParams={searchParams} />
      </Suspense>
      {/* 구글 지도는 공유 링크를 읽는 길이 없어 테이크아웃 파일로 (76) */}
      <Link href="/import/google" className="mx-5 mb-3 flex min-h-14 items-center justify-between gap-3 rounded-[14px] bg-surface px-4">
        <span className="flex items-center gap-3">
          <SourceMark source="google" size={24} />
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-semibold text-ink">구글 지도에서 가져오기</span>
            <span className="text-meta text-muted">구글에서 받은 파일을 올려요</span>
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-subtle" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
      {/* 리스트 링크가 아닌 SNS · 블로그 글에서 */}
      {TEXT_IMPORT_ENABLED && (
        <Link href="/import/text" className="mx-5 mb-8 flex min-h-14 items-center justify-between gap-3 rounded-[14px] bg-surface px-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-semibold text-ink">인스타그램이나 블로그 글에서 찾기</span>
            <span className="text-meta text-muted">글을 붙여 넣으면 가게를 찾아 드려요</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-subtle" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      )}
    </main>
  );
}

// 앱 공유 시트로 들어온 링크(?link=)는 바로 확인
async function SharedLink({ searchParams }: { searchParams: Promise<{ link?: string | string[] }> }) {
  const { link } = await searchParams;
  return <ImportFlow initialLink={typeof link === "string" ? link.slice(0, 500) : ""} />;
}
