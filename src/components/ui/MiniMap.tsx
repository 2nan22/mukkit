import { tierFromDb, type Tier } from "@/domain/tier";

export type MiniMapPoint = { lat: number; lng: number; tier: string | null };

const DOT: Partial<Record<Tier, string>> = {
  three: "bg-tier-3",
  two: "bg-pin-2",
  one: "bg-pin-1",
  notRecommended: "bg-pin-none",
  wantToGo: "bg-white ring-1 ring-ink-2",
};

// 리스트의 실제 장소 위치로 찍은 작은 미리보기 — 지도 타일 없이 점만
// card: 홈 카드(개수 표시) · thumb: 목록 줄 64px 썸네일
export function MiniMap({ points, count, size = "card" }: { points: MiniMapPoint[]; count?: number; size?: "card" | "thumb" }) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const pos = (v: number, lo: number, hi: number) => (hi - lo < 1e-6 ? 50 : 14 + ((v - lo) / (hi - lo)) * 72);
  const thumb = size === "thumb";
  return (
    <span aria-hidden="true" className={`relative block shrink-0 overflow-hidden bg-[#eef1ee] ${thumb ? "size-16 rounded-[10px]" : "h-28 rounded-[14px]"}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d="M70 -5c-8 18 6 30 -4 48s10 30 2 62h40v-110z" fill="#d6e6ef" />
        <path d="M-5 58c22-6 40 4 60-6s30-8 50-2" fill="none" stroke="#ffffff" strokeWidth="3" />
        <path d="M30 -5c4 30 -6 60 4 110" fill="none" stroke="#ffffff" strokeWidth="2" />
        <path d="M-5 24c30 6 50-4 105 10" fill="none" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
      {points.map((p, i) => (
        <span
          key={i}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-white shadow-sm ${thumb ? "size-2.5 border-[1.5px]" : "size-3 border-2"} ${(p.tier && DOT[tierFromDb(p.tier)]) || "bg-white ring-1 ring-pin-none"}`}
          style={{ left: `${pos(p.lng, minLng, maxLng)}%`, top: `${100 - pos(p.lat, minLat, maxLat)}%` }}
        />
      ))}
      {count !== undefined && !thumb && <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-caption font-semibold text-ink">{count}곳</span>}
    </span>
  );
}
