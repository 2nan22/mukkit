import Link from "next/link";
import { ImportFlow } from "@/features/import/ImportFlow";

export const metadata = { title: "가져오기" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/home" aria-label="닫기" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">저장한 장소 가져오기</h1>
        <span />
      </header>
      <ImportFlow />
    </main>
  );
}
