"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFollow } from "./actions";

export function FollowButton({ targetId, following }: { targetId: string; following: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
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
        className={`h-btn-m rounded-btn-m px-5 text-body font-bold disabled:opacity-60 ${
          following ? "border border-line-strong bg-white text-ink" : "bg-ink text-white"
        }`}
      >
        {following ? "팔로잉" : "팔로우"}
      </button>
      {error && (
        <p role="alert" className="text-caption text-[#c4320a]">
          {error}
        </p>
      )}
    </div>
  );
}
