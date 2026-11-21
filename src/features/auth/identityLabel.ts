// 설정 화면에 "어떤 계정이 연결됐는지" 한 줄 — 이메일은 가려서, 없으면 연결한 날로
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "";
  const shown = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${shown}***@${domain}`;
}

export function identityLabel(identity: { identity_data?: Record<string, unknown>; created_at?: string }): string {
  const email = identity.identity_data?.email;
  if (typeof email === "string" && email.includes("@")) return maskEmail(email);
  if (!identity.created_at) return "연결됨";
  const d = new Date(identity.created_at);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${date} 연결`;
}
