import type { Branch } from "@/domain/growth";

// 키우는 캐릭터 셋 — 사용자가 고른다. 그림 교체 지점: public/growth/{id}/stage{1~5}.svg · 4단계부터 {soup|bread}.svg
export const CHARACTERS = ["sangu", "sobok", "dudu"] as const;
export type CharacterId = (typeof CHARACTERS)[number];

export const CHARACTER_INFO: Record<CharacterId, { name: string; line: string }> = {
  sangu: { name: "상구", line: "상이 차려져요" },
  sobok: { name: "소복이", line: "밥이 소복해져요" },
  dudu: { name: "두두", line: "주름이 늘어요" },
};

export function isCharacterId(v: string | null | undefined): v is CharacterId {
  return !!v && (CHARACTERS as readonly string[]).includes(v);
}

export function characterSrc(id: CharacterId, stage: number, branch: Branch | null): string {
  return branch && stage >= 4 ? `/growth/${id}/${branch}.svg` : `/growth/${id}/stage${stage}.svg`;
}

export function Character({ id, stage, branch, size = 64 }: { id: CharacterId; stage: number; branch: Branch | null; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- 작은 SVG 라 이미지 최적화가 필요 없다
  return <img src={characterSrc(id, stage, branch)} width={size} height={size} alt="" aria-hidden="true" className="shrink-0" />;
}
