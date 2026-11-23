import { SourceMark } from "@/components/brand/BrandLogo";
import { BrandSymbol } from "@/components/brand/Wordmark";
import { Avatar } from "@/components/ui/Avatar";
import { TierBadge } from "@/components/ui/TierBadge";
import { TIER_LABEL, TIER_MEANING, type Tier } from "@/domain/tier";

// 소개 3장의 그림 — 세 장 모두 같은 틀: 색 패널 위에 아래로 잘린 휴대폰 화면 하나 + 떠 있는 카드
// 화면 안 내용은 실제 화면을 본뜬 장식이라 글자가 작다 (낭독기에는 숨긴다)

const FLOAT = "absolute z-10 rounded-[14px] bg-white shadow-[0_8px_24px_rgb(23_24_28/0.14),0_1px_2px_rgb(23_24_28/0.08)]";

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-6 -bottom-10 left-1/2 w-[236px] -translate-x-1/2 rounded-t-[36px] bg-ink p-[5px] pb-0 shadow-[0_18px_40px_rgb(23_24_28/0.22)] [@media(max-height:700px)]:top-4">
      <div className="relative flex h-full flex-col overflow-hidden rounded-t-[31px] bg-white">
        <div className="relative flex h-8 shrink-0 items-center justify-between px-5 text-[10px] font-semibold text-ink">
          <span>9:41</span>
          <span className="absolute top-2 left-1/2 h-[14px] w-[58px] -translate-x-1/2 rounded-full bg-ink" />
          <svg width="34" height="10" viewBox="0 0 34 10" fill="#17181c">
            <rect x="0" y="6" width="2.4" height="4" rx="0.6" />
            <rect x="3.8" y="4" width="2.4" height="6" rx="0.6" />
            <rect x="7.6" y="2" width="2.4" height="8" rx="0.6" />
            <rect x="11.4" y="0" width="2.4" height="10" rx="0.6" />
            <rect x="18.5" y="0.5" width="13" height="9" rx="2.6" fill="none" stroke="#17181c" strokeOpacity="0.4" />
            <rect x="20" y="2" width="8" height="6" rx="1.4" />
          </svg>
        </div>
        {children}
      </div>
    </div>
  );
}

function Pin({ n, x, y, big }: { n: 1 | 2 | 3 | 0; x: number; y: number; big?: boolean }) {
  if (n === 0) {
    return <span className="absolute size-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-pin-none shadow-[0_1px_2px_rgb(0_0_0/0.2)]" style={{ left: `${x}%`, top: y }} />;
  }
  const color = n === 3 ? "bg-tier-3 text-white" : n === 2 ? "bg-pin-2 text-white" : "bg-pin-1 text-[#3d2800]";
  return (
    <span
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white font-bold shadow-[0_2px_5px_rgb(0_0_0/0.22)] ${color} ${big ? "size-[28px] text-[13px]" : "size-[22px] text-[11px]"}`}
      style={{ left: `${x}%`, top: y }}
    >
      {n}
    </span>
  );
}

// 1장 — 네이버 · 카카오 리스트가 내 지도로
export function ImportArt() {
  return (
    <>
      <Phone>
        <div className="flex shrink-0 items-baseline gap-1.5 px-4 pt-1 pb-2.5">
          <span className="text-[15px] font-bold tracking-tight text-ink">내 지도</span>
          <span className="text-[11px] font-semibold text-muted">35곳</span>
        </div>
        <div className="relative flex-1 overflow-hidden bg-map-land">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 226 420" preserveAspectRatio="xMidYMin slice" fill="none">
            <path d="M-10 250C40 232 78 262 120 250s70-44 120-34v54C196 262 170 292 124 300S44 284-10 300z" fill="#d5e3f0" />
            <rect x="136" y="18" width="70" height="58" rx="10" fill="#dbe7d3" />
            <rect x="14" y="330" width="62" height="70" rx="10" fill="#dbe7d3" />
            <g stroke="#fff" strokeLinecap="round">
              <path d="M-10 108h246M-10 190h246M70-10v212M150-10v212" strokeWidth="7" />
              <path d="M-10 54h130M30 108v82M110 108v82M190 108v90M-10 330h246M110 300v130M180 290v140" strokeWidth="3.5" />
            </g>
          </svg>
          <Pin n={0} x={14} y={30} />
          <Pin n={3} x={63} y={84} />
          <Pin n={2} x={88} y={92} />
          <Pin n={2} x={22} y={150} />
          <Pin n={3} x={48} y={148} big />
          <Pin n={1} x={76} y={160} />
          <Pin n={3} x={84} y={214} />
          <Pin n={2} x={40} y={226} />
          <Pin n={0} x={12} y={204} />
          <Pin n={1} x={62} y={318} />
          <Pin n={2} x={30} y={352} />
          <Pin n={3} x={88} y={372} />
        </div>
      </Phone>
      <ListCard className="top-[72px] right-2.5 [@media(max-height:700px)]:top-[58px]" source="naver" name="을지로 노포" count="24곳" />
      <ListCard className="top-[132px] left-2.5 [@media(max-height:700px)]:top-[112px]" source="kakao" name="주말 브런치" count="11곳" />
    </>
  );
}

function ListCard({ source, name, count, className }: { source: "naver" | "kakao"; name: string; count: string; className: string }) {
  return (
    <div className={`${FLOAT} flex items-center gap-2.5 py-2.5 pr-3 pl-2.5 ${className}`}>
      <SourceMark source={source} size={30} />
      <span className="flex flex-col pr-1">
        <span className="text-[13px] leading-tight font-bold text-ink">{name}</span>
        <span className="text-[11px] leading-snug text-muted">{count} 가져옴</span>
      </span>
      <span className="flex size-[18px] items-center justify-center rounded-full bg-ink">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </div>
  );
}

// 2 · 3장이 같은 가게를 이어서 보여준다
function PlaceHead() {
  return (
    <div className="flex shrink-0 items-center gap-2.5 px-4 pt-1.5 pb-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-tier-2-soft text-tier-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11h18a9 9 0 0 1-18 0zM8 20h8M9 3c-1 1.3 1 2.2 0 4M14 3c-1 1.3 1 2.2 0 4" />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[14px] leading-tight font-bold tracking-tight text-ink">영남 순대국</span>
        <span className="text-[11px] leading-snug text-muted">순대국 · 을지로</span>
      </span>
    </div>
  );
}

const Star = () => <BrandSymbol height={11} className="fill-current" />;

const RATE_ROWS: Tier[] = ["three", "two", "one", "notRecommended"];

// 2장 — 가게 하나에 내 등급
export function RateArt() {
  return (
    <>
      <Phone>
        <PlaceHead />
        <div className="flex flex-col gap-1.5 px-3">
          {RATE_ROWS.map((t, i) => (
            <div key={t} className={`flex h-[46px] shrink-0 items-center gap-2.5 rounded-[12px] px-3 ${i === 0 ? "bg-ink text-white" : "bg-surface text-ink"}`}>
              <span className="flex flex-1 flex-col">
                <span className="flex items-center gap-1 text-[12.5px] leading-tight font-bold">
                  {t !== "notRecommended" && <Star />}
                  {TIER_LABEL[t]}
                </span>
                <span className={`text-[10.5px] leading-snug ${i === 0 ? "text-white/75" : "text-muted"}`}>{TIER_MEANING[t]}</span>
              </span>
              <span className={`flex size-[18px] items-center justify-center rounded-full ${i === 0 ? "bg-white" : "border-[1.5px] border-line-strong bg-white"}`}>
                {i === 0 && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#17181c" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
            </div>
          ))}
          <div className="mt-1 flex h-10 shrink-0 items-center rounded-[12px] border border-line-strong px-3 text-[11.5px] text-subtle">한 줄 평가를 남겨 보세요</div>
        </div>
      </Phone>
      <div className={`${FLOAT} top-[64px] right-2.5 flex items-center gap-2 py-2 pr-3 pl-2 [@media(max-height:700px)]:top-[50px]`}>
        <span className="flex size-[26px] items-center justify-center rounded-full border-2 border-white bg-tier-3 text-[12px] font-bold text-white shadow-[0_2px_5px_rgb(0_0_0/0.22)]">3</span>
        <span className="flex flex-col">
          <span className="text-[12px] leading-tight font-bold text-ink">내 지도에 표시</span>
          <span className="text-[10.5px] leading-snug text-muted">수저 셋 4곳째</span>
        </span>
      </div>
    </>
  );
}

const RATERS: { name: string; tier: Tier; line: string; mine?: boolean }[] = [
  { name: "민지", tier: "three", line: "이 국물 때문에 을지로까지 가요" },
  { name: "준호", tier: "two", line: "점심 줄이 길어도 기다릴 만해요" },
  { name: "서연", tier: "one", line: "근처에서 한 끼 하기 좋아요" },
  { name: "도윤", tier: "two", line: "수육은 꼭 같이 시키세요" },
];

// 3장 — 가게 평균 없이 사람 · 등급
export function TrustArt() {
  return (
    <>
      <Phone>
        <PlaceHead />
        <div className="flex shrink-0 items-center justify-between border-t border-line px-4 pt-3 pb-1">
          <span className="text-[12px] font-bold text-ink">팔로잉의 평가 4</span>
          <span className="text-[10.5px] text-subtle">협찬 평가 제외</span>
        </div>
        <div className="flex flex-col px-4">
          {RATERS.map((r) => (
            <div key={r.name} className="flex shrink-0 items-center gap-2.5 border-b border-line py-2.5">
              <Avatar name={r.name} size={32} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="text-[12px] leading-tight font-bold text-ink">{r.name}</span>
                  <TierBadge tier={r.tier} />
                </span>
                <span className="truncate text-[11px] leading-snug text-muted">{r.line}</span>
              </span>
            </div>
          ))}
        </div>
      </Phone>
      <div className={`${FLOAT} top-[64px] right-2.5 flex items-center gap-2 py-2 pr-3 pl-2 [@media(max-height:700px)]:top-[50px]`}>
        <Avatar name="민지" size={24} />
        <span className="flex flex-col">
          <span className="text-[12px] leading-tight font-bold text-ink">취향 겹침 82%</span>
          <span className="text-[10.5px] leading-snug text-muted">민지 · 팔로잉</span>
        </span>
      </div>
    </>
  );
}
