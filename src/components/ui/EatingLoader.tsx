import { CHOPSTICKS } from "@/components/brand/Wordmark";

// 불러오는 중 — 젓가락 두 짝이 밥알을 집어 올렸다 내려놓는 반복 (심볼의 젓가락 도형 그대로 · CSS 만)
// 빨리 끝나는 로딩에서 번쩍이지 않게 0.25초 뒤부터 보인다 · 움직임 줄이기면 멈춘 그림
export function EatingLoader({ size = 40, label = "불러오는 중" }: { size?: number; label?: string }) {
  return (
    <span role="status" className="eating-loader inline-flex" style={{ width: size, height: size }}>
      {/* 정사각 칸의 가운데 (680, 480) — 쉬는 자리와 들어 올린 자리의 사이 */}
      <svg viewBox="230 30 900 900" width={size} height={size} aria-hidden="true" className="overflow-visible">
        <ellipse className="eating-grain" cx="678" cy="862" rx="54" ry="36" />
        <path className="eating-stick eating-stick-l" d={CHOPSTICKS[0]} />
        <path className="eating-stick eating-stick-r" d={CHOPSTICKS[1]} />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

// 흰 원 안 젓가락 — 원 56px 에 젓가락 칸 40px, 정가운데. 페이지 이동 · 회색 틀 · 흰 화면 로딩이 함께 쓴다
export function LoaderBubble({ label }: { label?: string }) {
  return (
    <span className="flex size-14 items-center justify-center rounded-full bg-white shadow-float">
      <EatingLoader size={40} label={label} />
    </span>
  );
}

// 화면 하나가 통째로 기다릴 때 — 화면 정가운데
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
      <LoaderBubble label={label} />
    </div>
  );
}
