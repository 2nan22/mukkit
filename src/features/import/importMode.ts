import { z } from "zod";

// 가져올 때 리스트마다 묻는 것 — 등급별로 나눠 둔 리스트인가, 그냥 모아 둔 리스트인가
export const IMPORT_TIERS = ["three", "two", "one", "not_recommended", "want_to_go"] as const;

export const ImportModeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plain") }),
  z.object({ kind: z.literal("tier"), tier: z.enum(IMPORT_TIERS) }),
]);

export type ImportMode = z.infer<typeof ImportModeSchema>;
