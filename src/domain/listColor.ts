// 리스트 색 — 지도 '리스트로 보기' 핀 · 리스트 표시. 흰 숫자가 읽히는 진한 색만
// 등급 핀 색(빨강 · 주황 · 노랑)과 회색(리스트 없음 · 추천 안 함)은 일부러 뺐다 — 보기를 바꿔도 같은 화면처럼 보이지 않게
export const LIST_COLORS = {
  green: { hex: "#2f9e44", label: "초록", text: "#ffffff" },
  teal: { hex: "#0c8599", label: "청록", text: "#ffffff" },
  blue: { hex: "#1c7ed6", label: "파랑", text: "#ffffff" },
  navy: { hex: "#233d8a", label: "남색", text: "#ffffff" },
  indigo: { hex: "#5f3dc4", label: "보라", text: "#ffffff" },
  purple: { hex: "#ae3ec9", label: "자주", text: "#ffffff" },
  olive: { hex: "#5c7a29", label: "올리브", text: "#ffffff" },
  brown: { hex: "#8d5b3c", label: "갈색", text: "#ffffff" },
} as const;

export type ListColor = keyof typeof LIST_COLORS;
export const LIST_COLOR_KEYS = Object.keys(LIST_COLORS) as ListColor[];

export function isListColor(v: unknown): v is ListColor {
  return typeof v === "string" && v in LIST_COLORS;
}

// 고른 색이 없으면 id 로 정한 기본 색 — 같은 리스트는 늘 같은 색
export function listColorOf(id: string, color: string | null | undefined): ListColor {
  if (isListColor(color)) return color;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LIST_COLOR_KEYS[h % LIST_COLOR_KEYS.length];
}
