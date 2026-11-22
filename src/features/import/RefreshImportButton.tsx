"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { refreshImportedList } from "./refreshActions";
import { SOURCE_LABEL } from "./sources";

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
    <div className="flex flex-col gap-1 pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-meta ${status === "ok" ? "text-muted" : "text-danger"}`} suppressHydrationWarning>
          {status === "unavailable" ? `${SOURCE_LABEL[source]} 원본을 볼 수 없어요` : `${SOURCE_LABEL[source]} 원본 · ${ago(lastSyncedAt)}`}
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
          className="h-11 shrink-0 text-meta font-semibold text-ink disabled:opacity-50"
        >
          {pending ? "확인 중" : "원본에서 새로 고치기"}
        </button>
      </div>
      {status === "unavailable" && !message && <p className="text-meta text-muted">원본 리스트의 공개 범위를 확인해 주세요. 매일 새벽에도 다시 확인해요.</p>}
      <p role={message?.error ? "alert" : "status"} className={message ? `text-meta ${message.error ? "text-danger" : "text-ink-2"}` : "sr-only"}>
        {message?.text ?? ""}
      </p>
    </div>
  );
}
