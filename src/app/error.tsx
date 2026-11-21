"use client";

import Link from "next/link";
import { StatusScreen } from "@/components/ui/StatusScreen";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusScreen title="잠시 문제가 생겼어요" body="일시적인 오류일 수 있어요. 다시 시도해 주세요.">
      <button type="button" onClick={reset} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white">
        다시 시도
      </button>
      <Link href="/home" className="flex h-btn-m items-center justify-center text-body text-muted">
        홈으로
      </Link>
    </StatusScreen>
  );
}
