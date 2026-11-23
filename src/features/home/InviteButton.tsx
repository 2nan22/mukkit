"use client";

import { useState } from "react";

// 친구 초대 — 폰 공유 시트, 안 되면 링크 복사
export function InviteButton() {
  const [copied, setCopied] = useState(false);
  const invite = async () => {
    const url = window.location.origin;
    const text = "먹킷에서 내 맛집 지도를 같이 봐요";
    if (navigator.share) {
      await navigator.share({ title: "먹킷", text, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사도 막힌 브라우저 — 조용히 넘어감
    }
  };
  return (
    <button type="button" onClick={invite} className="flex h-11 shrink-0 items-center rounded-full bg-white px-4 text-meta font-semibold text-ink">
      {copied ? "링크를 복사했어요" : "친구 초대"}
    </button>
  );
}
