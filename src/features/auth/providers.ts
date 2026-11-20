import type { Provider } from "@supabase/supabase-js";

// 로그인 공급자 목록 한 곳 — 새 공급자는 여기와 Supabase 설정에만 추가한다
export const LOGIN_PROVIDERS = ["kakao", "google"] as const satisfies readonly Provider[];

export type LoginProvider = (typeof LOGIN_PROVIDERS)[number];

export function isLoginProvider(value: string): value is LoginProvider {
  return (LOGIN_PROVIDERS as readonly string[]).includes(value);
}
