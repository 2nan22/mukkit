"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { clampView, DOUBLE_TAP_SCALE, FIT, zoomAt, type View } from "./zoom";

// 두 손가락으로 확대 · 확대한 채 한 손가락으로 옮기기 · 두 번 눌러 확대/원래대로 (75-3, 사진 앱 관례)
// 1배일 때는 옆으로 넘기기를 사진 줄(부모)에 맡긴다 — touch-action pan-x. 확대 중엔 부모 넘기기를 막는다(onZoomed)
export function ZoomableImage({ src, alt, active, onZoomed }: { src: string; alt: string; active: boolean; onZoomed: (on: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const view = useRef<View>(FIT);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; start: View } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const moved = useRef(false);

  const apply = (v: View, animate = false) => {
    const el = box.current;
    if (!el || !img.current) return;
    const boxSize = { w: el.clientWidth, h: el.clientHeight };
    // 사진은 칸 가득(object-contain) — 실제로 그려진 사진 크기는 원본 비율로 칸에 맞춘 크기
    const { naturalWidth: nw, naturalHeight: nh } = img.current;
    const fit = nw && nh ? Math.min(boxSize.w / nw, boxSize.h / nh) : 1;
    const next = clampView(v, nw && nh ? { w: nw * fit, h: nh * fit } : boxSize, boxSize);
    view.current = next;
    img.current.style.transition = animate ? "transform 200ms ease-out" : "none";
    img.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`;
    el.style.touchAction = next.scale > 1 ? "none" : "pan-x";
    onZoomed(next.scale > 1);
  };

  // 다른 사진으로 넘기면 원래 크기로
  useEffect(() => {
    if (!active && view.current.scale !== 1) apply(FIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply 는 ref 만 쓴다
  }, [active]);

  // 상자 가운데 기준 좌표
  const local = (x: number, y: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
  };
  const pair = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: local((a.x + b.x) / 2, (a.y + b.y) / 2) };
  };

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) pinch.current = { ...pair(), start: view.current };
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 2) moved.current = true;
    if (pointers.current.size === 2 && pinch.current) {
      const { dist, mid } = pair();
      const p = pinch.current;
      const zoomed = zoomAt(p.start, p.start.scale * (dist / p.dist), p.mid);
      apply({ ...zoomed, x: zoomed.x + (mid.x - p.mid.x), y: zoomed.y + (mid.y - p.mid.y) });
    } else if (pointers.current.size === 1 && view.current.scale > 1) {
      apply({ ...view.current, x: view.current.x + e.clientX - prev.x, y: view.current.y + e.clientY - prev.y });
    }
  }

  function onUp(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size > 0 || moved.current) return;
    // 두 번 누르기 — 300ms 안 · 가까운 자리
    const now = e.timeStamp;
    const t = lastTap.current;
    if (t && now - t.t < 300 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) {
      lastTap.current = null;
      apply(view.current.scale > 1 ? FIT : zoomAt(view.current, DOUBLE_TAP_SCALE, local(e.clientX, e.clientY)), true);
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  }

  return (
    <div
      ref={box}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{ touchAction: "pan-x" }}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다 */}
      <img ref={img} src={src} alt={alt} draggable={false} className="size-full object-contain will-change-transform select-none" />
    </div>
  );
}
