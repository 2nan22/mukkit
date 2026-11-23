// 먹킷 글자 로고 — 수저 심볼 + 영문 대문자. 이름은 임시(2026-11-23 결정) · 바꾸면 이 파일과 앱 아이콘만 고친다
// 심볼 도형은 public/app-icon.svg 의 숟가락 · 젓가락을 평면으로 옮긴 것
export const BRAND_NAME = "먹킷";

// 도형에 딱 맞게 잘라 높이 기준으로 그린다 (가로는 약 0.7배)
export function BrandSymbol({ height = 22 }: { height?: number }) {
  return (
    <svg height={height} width={Math.round(height * 0.7)} viewBox="220 120 548 780" aria-hidden="true" className="shrink-0 fill-brand">
      <g>
        <path d="M336 470C356 496 372 522 374 554L358 850a42 42 0 0 0 84 0L426 554C428 522 444 496 464 470Z" />
        <ellipse cx="400" cy="312" rx="172" ry="184" />
        <path d="M596 170a30 30 0 0 1 60 0L647 870a21 21 0 0 1 -42 0Z" />
        <path d="M700 170a30 30 0 0 1 60 0L751 870a21 21 0 0 1 -42 0Z" />
      </g>
    </svg>
  );
}

// 읽는 이름은 한글(먹킷), 보이는 글자는 영문 대문자
export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const sm = size === "sm";
  return (
    <span className="flex items-center gap-2" role="img" aria-label={BRAND_NAME}>
      <BrandSymbol height={sm ? 17 : 22} />
      <span aria-hidden="true" className={`leading-none font-bold tracking-[0.1em] text-ink ${sm ? "text-[15px]" : "text-[20px]"}`}>
        MUKKIT
      </span>
    </span>
  );
}
