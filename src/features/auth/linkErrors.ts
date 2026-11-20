// 계정 연결 실패 사유 → 안내 문구. 모르는 코드는 일반 문구로 (원인은 서버 로그)
const MESSAGES: Record<string, string> = {
  identity_already_exists: "이 계정은 이미 다른 마이슐랭 계정에 연결돼 있어요. 그 계정으로 로그인해 주세요.",
  last_identity: "로그인 방법이 하나뿐이라 끊을 수 없어요.",
  manual_linking_disabled: "지금은 계정을 연결할 수 없어요. 잠시 뒤 다시 시도해주세요.",
};

export function linkErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? "연결하지 못했어요. 다시 시도해주세요.";
}
