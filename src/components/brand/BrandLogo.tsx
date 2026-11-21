// 카카오 · Google · 네이버 공식 심볼 — 각 사 로그인 버튼 가이드의 모양 · 색을 그대로 쓴다 (늘리거나 바꾸지 않는다)

export function KakaoSymbol({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 .6C4.03.6 0 3.71 0 7.55c0 2.39 1.56 4.5 3.93 5.75l-1 3.64c-.09.33.28.59.56.4l4.38-2.89c.37.04.75.06 1.13.06 4.97 0 9-3.11 9-6.96C18 3.71 13.97.6 9 .6"
        fill="#000000"
      />
    </svg>
  );
}

export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function NaverN({ size = 14, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill={color} d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845Z" />
    </svg>
  );
}

// 리스트 줄 · 카드에서 출처를 작게 표시하는 정사각 마크
export function SourceMark({ source, size = 16 }: { source: "naver" | "kakao"; size?: number }) {
  if (source === "naver") {
    return (
      <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-[#03C75A]" style={{ width: size, height: size }}>
        <NaverN size={size * 0.5} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-[#FEE500]" style={{ width: size, height: size }}>
      <KakaoSymbol size={size * 0.62} />
    </span>
  );
}

// 로그인 연결 화면의 공급자 마크
export function ProviderMark({ provider, size = 36 }: { provider: "kakao" | "google" | "naver"; size?: number }) {
  const box = { width: size, height: size };
  if (provider === "google") {
    return (
      <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-btn-m border border-line bg-white" style={box}>
        <GoogleG size={size * 0.5} />
      </span>
    );
  }
  if (provider === "naver") {
    return (
      <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-btn-m bg-[#03C75A]" style={box}>
        <NaverN size={size * 0.38} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-btn-m bg-[#FEE500]" style={box}>
      <KakaoSymbol size={size * 0.5} />
    </span>
  );
}
