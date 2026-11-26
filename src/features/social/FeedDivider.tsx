// 피드 '여기까지 새 평가' 구분선 (70-3, 인스타그램 '모두 확인했습니다'처럼) — none: 지난번 뒤로 새 평가가 없을 때(맨 위)
export function FeedDivider({ none }: { none: boolean }) {
  return (
    // 카드 하나 위에선 무거워 보여 원 · 글자를 한 단계 줄임 (80 디자인 검토)
    <div className="flex flex-col items-center gap-1 border-b border-line py-7 text-center">
      <span aria-hidden="true" className="mb-0.5 flex size-7 items-center justify-center rounded-full border-[1.5px] border-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="text-[14px] font-semibold tracking-[-0.01em]">{none ? "새 평가는 다 봤어요" : "여기까지 새 평가예요"}</span>
      <span className="text-meta text-muted">아래는 지난번에 본 평가예요</span>
    </div>
  );
}
