"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { refreshImportedList } from "./refreshActions";
import { SOURCE_LABEL } from "./sources";
import { MetaLine } from "@/components/ui/MetaLine";

function ago(iso: string | null): string {
  if (!iso) return "아직 확인 안 함";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금 확인";
  if (min < 60) return `${min}분 전 확인`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전 확인`;
  return `${Math.floor(min / 1440)}일 전 확인`;
}

// 가져온 리스트 — 원본 확인 시각 · 상태, 직접 새로 고치기 (매일 새벽에도 자동으로)
export function RefreshImportButton({ listId, source, status, lastSyncedAt }: { listId: string; source: PlaceSourceName; status: "ok" | "unavailable" | "error"; lastSyncedAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-meta ${status === "ok" ? "text-muted" : "text-danger"}`} suppressHydrationWarning>
          {status === "unavailable"
            ? `${SOURCE_LABEL[source]} 원본을 볼 수 없어요`
            : status === "error"
              ? `${SOURCE_LABEL[source]} 원본을 불러오지 못했어요`
              : <MetaLine className="" items={[`${SOURCE_LABEL[source]} 원본`, ago(lastSyncedAt)]} />}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await refreshImportedList(listId);
              setMessage(res.error ? { text: res.error, error: true } : { text: res.done ?? "" });
              router.refresh();
            })
          }
          aria-label={`${SOURCE_LABEL[source]} 원본에서 새로 고침`}
          className="flex h-11 min-w-11 shrink-0 items-center gap-1.5 text-meta font-semibold text-ink disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={pending ? "animate-spin" : ""}>
            <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
          </svg>
          {pending ? "확인 중" : "새로 고침"}
        </button>
      </div>
      {status === "unavailable" && !message && <p className="text-meta text-muted">원본 공개 범위를 바꾸면 다시 맞춰요.</p>}
      <p role={message?.error ? "alert" : "status"} className={message ? `text-meta ${message.error ? "text-danger" : "text-ink-2"}` : "sr-only"}>
        {message?.text ?? ""}
      </p>
    </div>
  );
}
