// 로그인해야 들어갈 수 있는 경로 — 새 보호 화면은 여기에만 추가한다
const PROTECTED_PREFIXES = ["/home", "/onboarding", "/settings", "/import", "/rate", "/map", "/lists", "/people", "/my", "/feed", "/p", "/eat"];

export const SIGNED_IN_HOME = "/home";
export const SIGNED_OUT_HOME = "/";
export const NICKNAME_SETUP = "/onboarding/nickname";
export const ONBOARDING_IMPORT = "/onboarding/import";
export const ACCOUNT_LINKS = "/settings/accounts";
// 로그인은 남았는데 계정이 없을 때 — 로그아웃 후 시작 화면
export const SESSION_ENDED = "/auth/session-ended";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// 로그인 뒤 돌아갈 곳 — 같은 사이트 경로만 허용 (외부로 튀는 리다이렉트 차단)
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return SIGNED_IN_HOME;
  }
  return next;
}
