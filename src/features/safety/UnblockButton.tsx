"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unblock } from "./actions";

export function UnblockButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await unblock(userId);
            if (res.error) setError(res.error);
            else router.refresh();
          })
        }
        className="flex h-12 items-center justify-center rounded-btn-m border border-line-strong px-5 text-body font-medium text-ink disabled:opacity-50"
      >
        차단 해제
      </button>
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
