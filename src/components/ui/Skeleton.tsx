import { EatingLoader } from "./EatingLoader";

// 불러오는 동안 화면 자리 — 흰 화면 대신 모양만 + 화면 가운데 젓가락 로딩
export function ListSkeleton({ rows = 5, hero = false }: { rows?: number; hero?: boolean }) {
  return (
    <div className="relative">
      {/* 페이지 옮길 때 로딩(NavLoading)과 같은 자리 — 화면 정가운데에서 그대로 이어지게 */}
      <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
        <span className="rounded-full bg-white/90 p-3 shadow-float">
          <EatingLoader size={40} />
        </span>
      </div>
      <Bones rows={rows} hero={hero} />
    </div>
  );
}

function Bones({ rows, hero }: { rows: number; hero: boolean }) {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-4 px-5 pt-2">
      {hero && <div className="h-36 rounded-[20px] bg-surface" />}
      <div className="h-5 w-32 rounded bg-surface" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="size-10 shrink-0 rounded-[12px] bg-surface" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 rounded bg-surface" />
            <div className="h-3 w-1/2 rounded bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}
