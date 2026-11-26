// 코드로 옮길 때(router.push)도 젓가락 로딩을 띄운다 — 링크 클릭만 잡던 NavLoading 이 이 신호도 받는다 (80)
export const NAV_START = "mk:nav-start";

export function navStart(to: string): void {
  window.dispatchEvent(new CustomEvent(NAV_START, { detail: to }));
}
