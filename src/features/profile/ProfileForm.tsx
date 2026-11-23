"use client";

import { useActionState, useEffect } from "react";
import { useLeave } from "@/lib/nav/useLeave";
import { NICKNAME_RULE } from "./nickname";
import { saveProfile, type ProfileFormState } from "./profileActions";

export function ProfileForm({ nickname, bio }: { nickname: string; bio: string }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const leave = useLeave("/my");
  useEffect(() => {
    if (state.saved) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장된 순간 한 번만
  }, [state]);
  return (
    <form action={action} className="flex flex-1 flex-col gap-5 px-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="text-meta font-bold">
          닉네임
        </label>
        <input id="nickname" name="nickname" defaultValue={nickname} maxLength={12} required className="h-12 rounded-btn-m border border-line-strong px-3.5 text-body outline-none focus:border-ink" />
        <span className="text-meta text-muted">{NICKNAME_RULE}</span>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="bio" className="text-meta font-bold">
          소개
        </label>
        <textarea id="bio" name="bio" defaultValue={bio} maxLength={150} rows={3} placeholder="예: 을지로 노포 위주로 다녀요" className="resize-none rounded-btn-m border border-line-strong px-3.5 py-3 text-body leading-normal outline-none focus:border-ink" />
      </div>
      {state.error && (
        <p role="alert" className="text-meta text-danger">
          {state.error}
        </p>
      )}
      {/* 입력칸이 둘뿐이라 버튼은 바로 아래 — 맨 아래로 밀면 안드로이드 홈 화면 앱에서 내비게이션 바에 가려 스크롤해야 보임 */}
      <button type="submit" disabled={pending} className="mt-1 h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand">
        {pending ? "저장하는 중" : "저장"}
      </button>
    </form>
  );
}
