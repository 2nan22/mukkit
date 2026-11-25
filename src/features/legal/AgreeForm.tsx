"use client";

import { useActionState } from "react";
import { agreeToTerms, type AgreeState } from "./actions";
import { AgreeCheck } from "./AgreeCheck";

// 약관 요약 — 약관 · 처리방침의 조 제목과 같은 말로 (70-6)
const SUMMARY: [string, string][] = [
  ["처리하는 정보", "저장한 장소, 등급, 한 줄 평가, 메모, 사진"],
  ["공개 범위", "회원이 설정한 공개 범위 안에서만 표시"],
  ["회원 탈퇴", "계정과 게시물 즉시 삭제, 복구 불가"],
];

// 주요 개정 내용 — 모요 · 위버스 개정 안내처럼 조항 단위로 (70-6)
const CHANGES: { article: string; body: string[] }[] = [
  {
    article: "제6조 (게시물의 권리와 이용)",
    body: ["평가와 마찬가지로 메모도 공개 범위를 설정할 수 있습니다.", "메모의 공개 범위는 평가보다 넓게 설정할 수 없습니다.", "기존 메모는 비공개로 설정되었습니다."],
  },
];

// revised: 이미 가입한 사람의 다시 동의 — 요약 대신 주요 변경 사항 · 시행일 · 동의하지 않을 때 안내
export function AgreeForm({ next, revised = false, effectiveDate }: { next: string; revised?: boolean; effectiveDate: string }) {
  const [state, action, pending] = useActionState<AgreeState, FormData>(agreeToTerms, {});
  return (
    <form action={action} className="flex flex-1 flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      {/* 무엇에 동의하는지 화면에서 바로 보이게 — 자세한 내용은 아래 약관 · 처리방침 링크 */}
      {revised ? (
        <section className="flex flex-col gap-4 rounded-[16px] bg-surface p-4 text-meta leading-normal text-ink-2 break-keep">
          <div className="flex flex-col gap-2">
            <h2 className="text-body font-semibold text-ink">주요 개정 내용</h2>
            {CHANGES.map((c) => (
              <div key={c.article} className="flex flex-col gap-1">
                <p className="font-semibold text-ink">{c.article}</p>
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {c.body.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-body font-semibold text-ink">개정 시행일</h2>
            <p>{effectiveDate}</p>
          </div>
          <p className="text-caption text-muted">
            개정 약관에 동의하지 않으시는 경우에는
            <br />
            설정에서 직접 회원 탈퇴하실 수 있습니다.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3 rounded-[16px] bg-surface p-4 text-body leading-normal text-ink-2">
          {SUMMARY.map(([title, body]) => (
            <li key={title} className="grid grid-cols-[5.5rem_1fr] gap-2 text-meta">
              <span className="font-semibold text-ink">{title}</span>
              <span>{body}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex-1" />
      {/* 버튼은 화면 아래에 붙여 둠 — 홈 화면 앱에서 화면 높이가 실제보다 크게 잡혀도 가려지지 않게 (55) */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 bg-white pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <AgreeCheck items={revised ? ["terms"] : undefined} />
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
