// 로그인해야 들어갈 수 있는 경로 — 새 보호 화면은 여기에만 추가한다
const PROTECTED_PREFIXES = ["/home", "/onboarding", "/settings", "/import", "/rate", "/map", "/lists", "/people", "/my", "/feed", "/p", "/eat", "/meet", "/rank", "/notifications", "/visits", "/search"];

export const SIGNED_IN_HOME = "/home";
export const SIGNED_OUT_HOME = "/";
export const NICKNAME_SETUP = "/onboarding/nickname";
export const ONBOARDING_IMPORT = "/onboarding/import";
// 처음 가입: 닉네임 → 약관 → 캐릭터 고르기 → 가져오기
export const ONBOARDING_CHARACTER = "/onboarding/character";
export const ACCOUNT_LINKS = "/settings/accounts";
// 로그인은 남았는데 계정이 없을 때 — 로그아웃 후 시작 화면
export const SESSION_ENDED = "/auth/session-ended";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// 로그인 뒤 돌아갈 곳 — 같은 사이트 경로만 허용 (외부로 튀는 리다이렉트 차단)
export function safeNextPath(next: string | null): string {
  // 제어 문자 · 역슬래시는 브라우저가 지우거나 바꿔 다른 사이트 주소로 풀 수 있어 통째로 거절
  if (!next || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return SIGNED_IN_HOME;
  const base = "http://mukkit.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return SIGNED_IN_HOME;
  }
  if (url.origin !== base) return SIGNED_IN_HOME;
  return url.pathname + url.search + url.hash;
}

// 닉네임 · 약관을 마친 계정 표시 쿠키 — 값에 사용자 · 약관 버전을 넣어 바뀌면 다시 확인
export const ONBOARDED_COOKIE = "mk_onboarded";
