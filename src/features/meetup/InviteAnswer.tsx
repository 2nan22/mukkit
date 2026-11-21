"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { respondInvite } from "./actions";

// 받은 초대 — 수락하면 위치를 넣고 함께 정하기
export function InviteAnswer({ meetupId, hostNickname, purposeLabel, when }: { meetupId: string; hostNickname: string; purposeLabel: string; when: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function answer(accept: boolean) {
    start(async () => {
      const res = await respondInvite(meetupId, accept);
      if (res?.error) return setError(res.error);
      router.refresh();
    });
  }
  return (
    <section className="flex flex-col gap-3 rounded-[16px] bg-brand-soft p-5">
      <span className="text-[18px] font-bold leading-snug">
        {hostNickname}님이 {purposeLabel} 약속에 초대했어요
      </span>
      <span className="text-meta text-ink-2">{when}</span>
      <span className="text-meta leading-normal text-ink-2">수락하면 출발지나 귀가지를 넣고, 두 사람 모두 가기 편한 곳을 함께 볼 수 있어요. 위치는 상대에게 보이지 않아요.</span>
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-[1fr_2fr] gap-2 pt-1">
        <button type="button" disabled={pending} onClick={() => answer(false)} className="h-btn-m rounded-btn-m bg-white text-body font-medium text-ink">
          거절
        </button>
        <button type="button" disabled={pending} onClick={() => answer(true)} className="h-btn-m rounded-btn-m bg-brand text-body font-bold text-white raised-brand disabled:opacity-60">
          수락하기
        </button>
      </div>
    </section>
  );
}
