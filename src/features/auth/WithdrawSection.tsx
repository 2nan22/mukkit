"use client";

import { useActionState, useState } from "react";
import { withdraw, type WithdrawState } from "./withdraw";

export function WithdrawSection() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WithdrawState, FormData>(withdraw, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-btn-m self-center text-meta text-muted underline underline-offset-[3px]">
        탈퇴하기
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[16px] border border-line p-4">
      <h2 className="text-body font-bold">탈퇴하면 바로 지워져요</h2>
      <ul className="flex flex-col gap-1 text-meta leading-normal text-ink-2 [&_li]:ml-4 [&_li]:list-disc">
        <li>저장한 장소 · 등급 · 한 줄 평가 · 메모</li>
        <li>올린 사진 · 영상</li>
        <li>만든 리스트(공유 링크도 더 이상 열리지 않아요) · 팔로우</li>
        <li>네이버 · 카카오에서 가져온 원본</li>
      </ul>
      <p className="text-meta text-muted">되돌릴 수 없어요. 계속하려면 아래에 &lsquo;탈퇴&rsquo;를 입력해 주세요.</p>
      <input
        name="confirm"
        aria-label="확인 문구"
        autoComplete="off"
        placeholder="탈퇴"
        className="h-12 rounded-[12px] border border-transparent bg-surface px-3.5 text-body outline-none focus:border-ink"
      />
      {state.error && (
        <p role="alert" className="text-meta text-danger">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-btn-m rounded-btn-m bg-surface text-body font-medium text-ink">
          취소
        </button>
        <button type="submit" disabled={pending} className="h-btn-m rounded-btn-m bg-danger text-body font-bold text-white disabled:opacity-60">
          {pending ? "지우는 중" : "탈퇴"}
        </button>
      </div>
    </form>
  );
}
