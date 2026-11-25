// 피드 '여기까지 새 평가' 구분선 (70-3, 인스타그램 '모두 확인했습니다'처럼) — none: 지난번 뒤로 새 평가가 없을 때(맨 위)
export function FeedDivider({ none }: { none: boolean }) {
  return (
    <div role="separator" aria-label={none ? "새 평가는 다 봤어요" : "여기까지 새 평가예요"} className="flex flex-col items-center gap-1.5 border-b border-line py-6 text-center">
      <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full border-2 border-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="text-body font-bold">{none ? "새 평가는 다 봤어요" : "여기까지 새 평가예요"}</span>
      <span className="text-meta text-muted">아래는 지난번에 본 평가예요</span>
    </div>
  );
}
