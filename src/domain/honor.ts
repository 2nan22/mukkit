// 닉네임에 '님' 붙이기 — 이미 '님'으로 끝나면 그대로 (셋째손님님 방지)
export function honor(nickname: string): string {
  return nickname.endsWith("님") ? nickname : `${nickname}님`;
}
