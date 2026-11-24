// 홈 내 지도 칩 이름 (65) — 사람들이 말하는 동 이름으로: 행정동의 숫자 · '가'를 뗀다 (성수1가1동 → 성수동, 역삼1동 → 역삼동)
// 지도가 넓게 보이면(세로 약 3km 넘게) 동이 아니라 구까지만 — 숫자가 세는 범위와 맞추기
const WIDE_LAT = 0.027;

export function shortDong(dong: string): string {
  return dong.replace(/([가-힣])(\d+가)?\d+동$/, "$1동");
}

export function regionLabel(gu: string, dong: string, latSpan: number): string {
  if (!dong || latSpan > WIDE_LAT) return gu;
  return `${gu} ${shortDong(dong)}`;
}
