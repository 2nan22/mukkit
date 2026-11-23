import type { Branch } from "@/domain/growth";

// 키우는 캐릭터 그림 — 교체 지점. 파일: public/growth/stage{1~5}.svg · 4단계부터 갈래 그림 {branch}-{stage}.svg
export const CHARACTER_NAME = "숟이";

export function characterSrc(stage: number, branch: Branch | null): string {
  return branch && stage >= 4 ? `/growth/${branch}-${stage}.svg` : `/growth/stage${stage}.svg`;
}

export function Character({ stage, branch, size = 64 }: { stage: number; branch: Branch | null; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- 작은 SVG 라 이미지 최적화가 필요 없다
  return <img src={characterSrc(stage, branch)} width={size} height={size} alt="" aria-hidden="true" className="shrink-0" />;
}
