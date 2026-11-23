import { CHOPSTICKS } from "@/components/brand/Wordmark";

// 불러오는 중 — 젓가락 두 짝이 밥알을 집어 올렸다 내려놓는 반복 (심볼의 젓가락 도형 그대로 · CSS 만)
// 빨리 끝나는 로딩에서 번쩍이지 않게 0.25초 뒤부터 보인다 · 움직임 줄이기면 멈춘 그림
export function EatingLoader({ size = 40, label = "불러오는 중" }: { size?: number; label?: string }) {
  return (
    <span role="status" className="eating-loader inline-flex" style={{ width: size, height: size }}>
      <svg viewBox="520 120 340 860" width={size} height={size} aria-hidden="true" className="overflow-visible">
        <ellipse className="eating-grain" cx="678" cy="862" rx="42" ry="29" />
        <path className="eating-stick eating-stick-l" d={CHOPSTICKS[0]} />
        <path className="eating-stick eating-stick-r" d={CHOPSTICKS[1]} />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

// 화면 하나가 통째로 기다릴 때 — 페이지 옮길 때 로딩 · 회색 틀과 같은 모양 · 같은 자리(화면 정가운데)
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
      <span className="rounded-full bg-white/90 p-3 shadow-float">
        <EatingLoader size={40} label={label} />
      </span>
    </div>
  );
}
