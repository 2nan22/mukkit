import type { Provider } from "@supabase/supabase-js";

// 로그인 경로 이름 → Supabase 공급자 이름. 새 공급자는 여기와 Supabase 설정(또는 등록 스크립트)에만 추가한다
const LOGIN_PROVIDERS = {
  kakao: "kakao",
  google: "google",
  naver: "custom:naver",
} as const satisfies Record<string, Provider>;

export type LoginProvider = keyof typeof LOGIN_PROVIDERS;

export function isLoginProvider(value: string): value is LoginProvider {
  return Object.hasOwn(LOGIN_PROVIDERS, value);
}

export function toSupabaseProvider(provider: LoginProvider): Provider {
  return LOGIN_PROVIDERS[provider];
}
