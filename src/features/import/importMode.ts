import { z } from "zod";

// 가져올 때 리스트마다 묻는 것 — 등급별로 나눠 둔 리스트인가, 그냥 모아 둔 리스트인가
export const IMPORT_TIERS = ["three", "two", "one", "not_recommended", "want_to_go"] as const;
export type ImportTier = (typeof IMPORT_TIERS)[number];

export const ImportModeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plain") }),
  z.object({ kind: z.literal("tier"), tier: z.enum(IMPORT_TIERS) }),
]);

export type ImportMode = z.infer<typeof ImportModeSchema>;

export const IMPORT_TIER_LABEL: Record<ImportTier, string> = {
  three: "3스타",
  two: "2스타",
  one: "1스타",
  not_recommended: "추천 안 함",
  want_to_go: "가고 싶은 곳",
};

export const PLAIN_LABEL = "리스트로 · 평가 전";

export function modeLabel(mode: ImportMode): string {
  return mode.kind === "plain" ? PLAIN_LABEL : IMPORT_TIER_LABEL[mode.tier];
}

// select 값 하나로 오가기 위한 직렬화 — "plain" 또는 등급 값
export function modeToValue(mode: ImportMode): string {
  return mode.kind === "plain" ? "plain" : mode.tier;
}

export function modeFromValue(value: string): ImportMode {
  const tier = IMPORT_TIERS.find((t) => t === value);
  return tier ? { kind: "tier", tier } : { kind: "plain" };
}

const NAME_HINTS: [RegExp, ImportTier][] = [
  [/3\s*스타|★{3}|별\s*3/, "three"],
  [/2\s*스타|★{2}|별\s*2/, "two"],
  [/1\s*스타|★|별\s*1/, "one"],
  [/추천\s*안|비추|별로/, "not_recommended"],
  [/가고\s*싶|가\s*볼|가보고|위시/, "want_to_go"],
];

// 리스트 이름으로 미리 골라 둔다 — 사용자가 바꿀 수 있다
export function guessMode(listName: string): ImportMode {
  const hit = NAME_HINTS.find(([pattern]) => pattern.test(listName));
  return hit ? { kind: "tier", tier: hit[1] } : { kind: "plain" };
}
