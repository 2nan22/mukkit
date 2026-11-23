"use client";

import { useState } from "react";

// 친구 초대 — 내 프로필 주소를 보내 받은 사람이 바로 팔로우로 이어지게. 폰 공유 시트, 안 되면 링크 복사
export function InviteButton({ me }: { me: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const invite = async () => {
    const url = `${window.location.origin}/u/${me}`;
    const text = "먹킷에서 내 맛집 지도 같이 봐요. 광고도 별점 평균도 없어요";
    if (navigator.share) {
      await navigator.share({ title: "먹킷", text, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button type="button" onClick={invite} aria-live="polite" className="flex h-11 min-w-[88px] shrink-0 items-center justify-center rounded-full bg-white px-4 text-meta font-semibold text-ink">
      {state === "copied" ? "복사했어요" : state === "failed" ? "복사 못 함" : "친구 초대"}
    </button>
  );
}
