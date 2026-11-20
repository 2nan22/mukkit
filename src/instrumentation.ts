import { readPublicEnv } from "@/config/env";

// 서버 기동 시 한 번 — 필수 환경변수가 비면 여기서 죽는다
export function register() {
  readPublicEnv();
}
