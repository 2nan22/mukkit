import { Fragment, type ReactNode } from "react";

// 짧은 정보 여러 개를 한 줄에 — 가운데 점 대신 얇은 세로선으로 나눈다 (68-6, 네이버 지도 · 카카오맵 장소 목록처럼)
// 빈 값은 건너뛴다. 줄이 넘치면 다음 줄로 (세로선은 앞 항목에 붙어 줄 끝에 남지 않게)
export function MetaLine({ items, className = "text-meta text-muted" }: { items: ReactNode[]; className?: string }) {
  const shown = items.filter((i) => i !== null && i !== undefined && i !== false && i !== "");
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {shown.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true" className="h-2.5 w-px shrink-0 bg-line-strong" />}
          <span className="min-w-0">{item}</span>
        </Fragment>
      ))}
    </span>
  );
}
