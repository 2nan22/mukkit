// 먹킷 글자 로고 — 수저 심볼 + 영문 대문자. 이름은 임시(2026-11-23 결정) · 바꾸면 이 파일과 앱 아이콘만 고친다
// 심볼 도형은 public/app-icon.svg 의 숟가락 · 젓가락을 평면으로 옮긴 것
export const BRAND_NAME = "먹킷";

// 도형에 딱 맞게 잘라 높이 기준으로 그린다 (가로는 약 0.7배)
export function BrandSymbol({ height = 22, className = "fill-brand" }: { height?: number; className?: string }) {
  return (
    <svg height={height} width={Math.round(height * 0.7)} viewBox="220 120 548 780" aria-hidden="true" className={`shrink-0 ${className}`}>
      <g>
        <path d="M336 470C356 496 372 522 374 554L358 850a42 42 0 0 0 84 0L426 554C428 522 444 496 464 470Z" />
        <ellipse cx="400" cy="312" rx="172" ry="184" />
        <path d="M596 170a30 30 0 0 1 60 0L647 870a21 21 0 0 1 -42 0Z" />
        <path d="M700 170a30 30 0 0 1 60 0L751 870a21 21 0 0 1 -42 0Z" />
      </g>
    </svg>
  );
}

// 글자 로고 — 한글 '먹킷'을 크게, 영문 MUKKIT 을 아래 작게 (44, 사용자 결정 2026-11-23 B안: 영문만이면 '무킷'으로 읽힘)
// 두 줄 글자 묶음의 위 · 아래를 수저 심볼 높이에 맞춘다
const MARK = {
  md: { h: 32, ko: 21, en: 8.5, gap: 9, nudge: 1 },
  sm: { h: 26, ko: 17, en: 7, gap: 7, nudge: 0.8 },
} as const;

export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const m = MARK[size];
  return (
    <span className="flex items-center" style={{ gap: m.gap }} role="img" aria-label={BRAND_NAME}>
      <BrandSymbol height={m.h} />
      <span aria-hidden="true" className="flex flex-col justify-between" style={{ height: m.h }}>
        {/* nudge: 한글 글자 윗선을 숟가락 머리 윗선에 맞추는 보정 */}
        <span className="block leading-[0.8] font-bold tracking-[-0.02em] text-ink" style={{ fontSize: m.ko, marginTop: m.nudge }}>
          먹킷
        </span>
        {/* 영문은 한글 묶음과 너비를 맞춘다 — 마지막 글자 뒤 자간은 빼기 */}
        <span className="block leading-[0.75] font-bold tracking-[0.1em] text-muted" style={{ fontSize: m.en, marginRight: "-0.1em" }}>
          MUKKIT
        </span>
      </span>
    </span>
  );
}
