"use client";

import { useActionState } from "react";
import { agreeToTerms, type AgreeState } from "./actions";
import { AgreeCheck } from "./AgreeCheck";

const SUMMARY: [string, string][] = [
  ["저장하는 것", "가져오거나 저장한 가게, 등급, 한 줄 평가, 메모, 올린 사진이에요."],
  ["보이는 범위", "평가와 메모는 내가 설정한 공개 범위 안에서만 보여요."],
  ["지우기", "설정에서 탈퇴하면 기록과 사진을 모두 지워요."],
];

// 약관 개정 때 이미 가입한 사람에게 — 주요 변경 사항 (토스 · 카카오 개정 안내 형식, 70-5)
const CHANGES: string[] = ["메모도 평가처럼 공개 범위(비공개, 팔로워 공개, 전체 공개)를 설정할 수 있어요. 지금까지 쓴 메모는 비공개로 두었어요."];

// revised: 이미 가입한 사람의 다시 동의 — 요약 대신 주요 변경 사항 · 시행일 · 동의하지 않을 때 안내
export function AgreeForm({ next, revised = false, effectiveDate }: { next: string; revised?: boolean; effectiveDate: string }) {
  const [state, action, pending] = useActionState<AgreeState, FormData>(agreeToTerms, {});
  return (
    <form action={action} className="flex flex-1 flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      {/* 무엇에 동의하는지 화면에서 바로 보이게 — 자세한 내용은 아래 약관 · 처리방침 링크 */}
      {revised ? (
        <section className="flex flex-col gap-3 rounded-[16px] bg-surface p-4 text-body leading-normal text-ink-2">
          <h2 className="font-semibold text-ink">주요 변경 사항</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-meta">
            {CHANGES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-meta">
            시행일 <b className="font-semibold text-ink">{effectiveDate}</b>
          </p>
          <p className="text-caption text-muted">개정 약관에 동의하지 않으시면 설정에서 회원 탈퇴를 할 수 있어요.</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3 rounded-[16px] bg-surface p-4 text-body leading-normal text-ink-2">
          {SUMMARY.map(([title, body]) => (
            <li key={title} className="flex flex-col gap-0.5">
              <span className="font-semibold text-ink">{title}</span>
              <span className="text-meta">{body}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex-1" />
      {/* 버튼은 화면 아래에 붙여 둠 — 홈 화면 앱에서 화면 높이가 실제보다 크게 잡혀도 가려지지 않게 (55) */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 bg-white pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <AgreeCheck />
        {state.error && (
          <p role="alert" className="text-meta text-danger">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand">
          {pending ? "저장하는 중" : "동의하고 계속하기"}
        </button>
      </div>
    </form>
  );
}
