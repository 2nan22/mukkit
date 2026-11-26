"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { honor } from "@/domain/honor";
import { setFollow } from "./actions";

// followLabel: 내 팔로워 목록에서 아직 안 팔로우한 사람은 '맞팔로우' (74-2, 스레드 · 인스타그램 말)
// 팔로우는 바로, '팔로잉'을 누르면 확인 시트 뒤에 취소 (75, 인스타그램 · 스레드 형식)
export function FollowButton({
  targetId,
  following,
  nickname,
  compact = false,
  primary = false,
  followLabel = "팔로우",
}: {
  targetId: string;
  following: boolean;
  nickname?: string;
  compact?: boolean;
  primary?: boolean;
  followLabel?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const apply = (on: boolean) =>
    start(async () => {
      const res = await setFollow(targetId, on);
      setError(res.error ?? null);
      router.refresh();
    });
  return (
    <div className={`flex flex-col gap-1 ${primary ? "w-full [&>button]:w-full" : ""}`}>
      <button
        type="button"
        disabled={pending}
        onClick={() => (following ? setConfirming(true) : apply(true))}
        className={`${compact ? "h-8 rounded-btn-s px-3.5 text-meta" : "h-btn-m rounded-btn-m px-5 text-body"} font-bold disabled:opacity-60 ${
          following ? "bg-surface text-ink ring-1 ring-line-strong ring-inset" : primary ? "bg-brand text-white" : "bg-brand-soft font-semibold text-brand"
        }`}
      >
        {following ? "팔로잉" : followLabel}
      </button>
      {confirming &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={() => setConfirming(false)}>
            <section
              tabIndex={-1}
              ref={(el) => el?.focus()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="unfollow-title"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === "Escape" && setConfirming(false)}
              className="flex w-full max-w-[480px] flex-col gap-1 rounded-t-[20px] bg-white px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none"
            >
              <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
              <h2 id="unfollow-title" className="pt-3 pb-2 text-section font-bold">
                {nickname ? `${honor(nickname)} 팔로우를 취소할까요?` : "팔로우를 취소할까요?"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  apply(false);
                }}
                className="flex h-12 items-center text-body font-semibold text-danger"
              >
                팔로우 취소
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="flex h-12 items-center text-body text-ink">
                닫기
              </button>
            </section>
          </div>,
          document.body,
        )}
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
