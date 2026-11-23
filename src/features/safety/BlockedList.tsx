"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { unblock } from "./actions";
import type { BlockedPerson } from "./safety";

// 설정 › 차단한 사람 — 해제
export function BlockedList({ people }: { people: BlockedPerson[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      {people.length === 0 ? (
        <p className="flex min-h-12 items-center border-b border-line text-meta text-muted">차단한 사람이 없어요</p>
      ) : (
        <ul className="flex flex-col">
          {people.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-line">
              <Avatar name={p.nickname} size={40} />
              <span className="flex-1 truncate text-body font-semibold">{p.nickname}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await unblock(p.id);
                    if (res.error) setError(res.error);
                    else router.refresh();
                  })
                }
                aria-label={`${p.nickname}님 차단 해제`}
                className="h-11 rounded-btn-s border border-line-strong px-4 text-meta text-ink-2 disabled:opacity-50"
              >
                해제
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
