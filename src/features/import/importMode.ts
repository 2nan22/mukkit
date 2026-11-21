import { z } from "zod";
import { TIER_LABEL, tierFromDb } from "@/domain/tier";

// 가져올 때 리스트마다 묻는 것 — 등급별로 나눠 둔 리스트인가, 그냥 모아 둔 리스트인가
export const IMPORT_TIERS = ["three", "two", "one", "not_recommended", "want_to_go"] as const;
export type ImportTier = (typeof IMPORT_TIERS)[number];

export const ImportModeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plain") }),
  z.object({ kind: z.literal("tier"), tier: z.enum(IMPORT_TIERS) }),
]);

export type ImportMode = z.infer<typeof ImportModeSchema>;

export const IMPORT_TIER_LABEL = Object.fromEntries(
  IMPORT_TIERS.map((t) => [t, TIER_LABEL[tierFromDb(t)]]),
) as Record<ImportTier, string>;

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

const STAR = "\\s*(?:스타|star|stars|별)";
const NAME_HINTS: [RegExp, ImportTier][] = [
  [new RegExp(`3${STAR}|★{3}|별\\s*3`, "i"), "three"],
  [new RegExp(`2${STAR}|★{2}|별\\s*2`, "i"), "two"],
  [new RegExp(`1${STAR}|★|별\\s*1`, "i"), "one"],
  [new RegExp(`0${STAR}|추천\\s*안|비추|별로`, "i"), "not_recommended"],
  [/가고\s*싶|가\s*볼|가보고|위시|먹킷|버킷|wish/i, "want_to_go"],
];

// 리스트 이름으로 미리 골라 둔다 — 사용자가 바꿀 수 있다
export function guessMode(listName: string): ImportMode {
  const hit = NAME_HINTS.find(([pattern]) => pattern.test(listName));
  return hit ? { kind: "tier", tier: hit[1] } : { kind: "plain" };
}
