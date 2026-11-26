"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFollow } from "./actions";

// followLabel: 내 팔로워 목록에서 아직 안 팔로우한 사람은 '맞팔로우' (74-2, 스레드 · 인스타그램 말)
export function FollowButton({ targetId, following, compact = false, primary = false, followLabel = "팔로우" }: { targetId: string; following: boolean; compact?: boolean; primary?: boolean; followLabel?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={`flex flex-col gap-1 ${primary ? "w-full [&>button]:w-full" : ""}`}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setFollow(targetId, !following);
            setError(res.error ?? null);
            router.refresh();
          })
        }
        className={`${compact ? "h-8 rounded-btn-s px-3.5 text-meta" : "h-btn-m rounded-btn-m px-5 text-body"} font-bold disabled:opacity-60 ${
          following ? "bg-surface text-ink" : primary ? "bg-brand text-white" : "bg-brand-soft font-semibold text-brand"
        }`}
      >
        {following ? "팔로잉" : followLabel}
      </button>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
