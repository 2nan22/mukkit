// 시작하기 화면 상단 지도 그림 — 실제 지도 SDK 가 아니라 장식
const PINS = [
  { left: 110, top: 120, label: "3", size: "lg", tone: "bg-tier-3 text-white" },
  { left: 240, top: 110, label: "2", size: "md", tone: "bg-pin-2 text-white" },
  { left: 316, top: 230, label: "3", size: "md", tone: "bg-tier-3 text-white" },
  { left: 60, top: 280, label: "2", size: "md", tone: "bg-pin-2 text-white" },
  { left: 204, top: 262, label: "1", size: "md", tone: "bg-pin-1 text-[#3d2800]" },
] as const;

export function MapIllustration() {
  return (
    <div aria-hidden="true" className="relative h-[300px] shrink-0 overflow-hidden bg-map-land">
      <div className="absolute -left-[60px] top-[220px] h-14 w-[520px] -rotate-12 bg-[#cfe0ec]" />
      <div className="absolute left-10 top-[90px] h-[70px] w-[110px] rounded-[22px] bg-[#dce9d3]" />
      <div className="absolute left-0 top-[70px] h-2.5 w-full bg-white" />
      <div className="absolute left-0 top-[180px] h-2 w-full bg-white" />
      <div className="absolute left-[46%] top-0 h-full w-2.5 bg-white" />
      <div className="absolute left-[77%] top-0 h-full w-1.5 bg-white" />
      {PINS.map((pin) => (
        <span
          key={`${pin.left}-${pin.top}`}
          className={`absolute flex items-center justify-center rounded-full border-white font-bold shadow-float ${pin.tone} ${
            pin.size === "lg" ? "size-[30px] border-[3px] text-meta" : "size-[22px] border-2 text-caption"
          }`}
          style={{ left: `${(pin.left / 390) * 100}%`, top: pin.top }}
        >
          {pin.label}
        </span>
      ))}
      <div className="absolute left-10 top-[162px] flex flex-col gap-0.5 rounded-btn-l bg-white px-3 py-2.5 shadow-float">
        <span className="text-meta font-bold text-ink">영남 순대국</span>
        <span className="text-caption text-muted">팔로잉 3명이 3스타</span>
      </div>
    </div>
  );
}
