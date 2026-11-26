// 사진 확대 계산 (75-3) — 화면에 맞춘 크기(1배)에서 최대 4배, 가운데 기준 transform
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;

export type View = { scale: number; x: number; y: number };
export const FIT: View = { scale: 1, x: 0, y: 0 };

// 사진 가장자리가 화면 안으로 들어와 빈 곳이 보이지 않게 — 화면보다 커진 만큼만 옮길 수 있다
// pic: 1배일 때 사진이 그려진 크기, box: 화면(사진 칸) 크기
export function clampView(v: View, pic: { w: number; h: number }, box: { w: number; h: number }): View {
  const scale = Math.min(MAX_SCALE, Math.max(1, v.scale));
  const maxX = Math.max(0, (pic.w * scale - box.w) / 2);
  const maxY = Math.max(0, (pic.h * scale - box.h) / 2);
  // || 0 — 못 옮기는 축의 -0 을 0 으로
  return { scale, x: Math.min(maxX, Math.max(-maxX, v.x)) || 0, y: Math.min(maxY, Math.max(-maxY, v.y)) || 0 };
}

// 한 점(at, 상자 가운데 기준 좌표)을 손가락 밑에 둔 채 배율을 바꾼다 — 두 손가락 사이 · 두 번 누른 곳이 그대로 있게
export function zoomAt(v: View, nextScale: number, at: { x: number; y: number }): View {
  const k = nextScale / v.scale;
  return { scale: nextScale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k };
}
