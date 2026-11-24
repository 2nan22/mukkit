import { Fragment, type ReactNode } from "react";

// 짧은 정보 여러 개를 한 줄에 — 가운데 점 대신 얇은 세로선으로 나눈다 (68-6, 네이버 지도 · 카카오맵 장소 목록처럼)
// 빈 값은 건너뛴다. 기본은 한 줄 · 넘치면 마지막 항목만 말줄임(짧은 앞 항목은 그대로) · wrap 이면 줄바꿈(추천 이유 · 링크 줄)
// 세로선은 화면 낭독기에서 쉼표로 읽혀 항목이 붙어 읽히지 않게
export function MetaLine({ items, className = "text-meta text-muted", wrap = false }: { items: ReactNode[]; className?: string; wrap?: boolean }) {
  const shown = items.filter((i) => i !== null && i !== undefined && i !== false && i !== "");
  return (
    <span className={`inline-flex max-w-full min-w-0 items-center ${wrap ? "flex-wrap gap-x-2 gap-y-0.5" : "gap-2 overflow-hidden whitespace-nowrap"} ${className}`}>
      {shown.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <span aria-hidden="true" className="h-2.5 w-px shrink-0 bg-line-strong" />
              <span className="sr-only">, </span>
            </>
          )}
          <span className={wrap ? "" : i === shown.length - 1 ? "min-w-0 truncate" : "shrink-0"}>{item}</span>
        </Fragment>
      ))}
    </span>
  );
}
