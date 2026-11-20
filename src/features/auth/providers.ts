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

export const LOGIN_PROVIDER_LABEL: Record<LoginProvider, string> = {
  kakao: "카카오",
  google: "구글",
  naver: "네이버",
};

export const LOGIN_PROVIDER_ORDER: LoginProvider[] = ["kakao", "google", "naver"];

// Supabase 가 돌려주는 identity.provider 값 → 로그인 경로 이름
export function fromSupabaseProvider(value: string): LoginProvider | undefined {
  return (Object.keys(LOGIN_PROVIDERS) as LoginProvider[]).find((key) => LOGIN_PROVIDERS[key] === value);
}
