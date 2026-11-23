import "server-only";
import { timingSafeEqual } from "node:crypto";

// Vercel Cron 이 보내는 Authorization: Bearer <CRON_SECRET> 확인 — 길이 차이로 새지 않게 같은 시간에 비교
export function isCronAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
