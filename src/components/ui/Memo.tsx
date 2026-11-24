import { SourceMark, type MemoSource } from "@/components/brand/BrandLogo";

const SOURCE_NAME: Record<MemoSource, string> = { naver: "네이버 지도 메모", kakao: "카카오맵 메모", google: "구글 지도 메모" };

// 메모 한 칸 — 왼쪽 아이콘(지도 앱에서 가져온 메모면 그 앱 로고, 아니면 메모 아이콘) · 오른쪽 내용 (68-6)
// 가운데 점으로 이름표와 내용을 한 줄에 잇지 않는다. caption: 내 메모를 누가 보는지 (내 화면에서만)
// alias: 지도 앱 별명 — 메모와 따로 '별명' 배지 줄 (68-7) · 별명이 있으면 메모 줄에도 '메모' 배지 (68-8)
export function Memo({ text, alias, source, caption, tone = "surface", clamp }: { text: string; alias?: string; source?: string | null; caption?: string; tone?: "surface" | "white"; clamp?: 3 }) {
  // 별명만 있으면 별명이 온 네이버 로고 (별명은 네이버에만 있음)
  const mark = source === "naver" || source === "kakao" || source === "google" ? source : alias && !text ? "naver" : null;
  return (
    <div className={`flex gap-2.5 rounded-btn-s px-3 py-2.5 ${tone === "white" ? "bg-white" : "bg-surface"}`}>
      {/* 아이콘을 첫 줄 높이(1lh)에 맞춰 가운데 — 글 첫 줄과 나란히 */}
      <span className="flex h-[1lh] shrink-0 items-center text-meta leading-normal">{mark ? <SourceMark source={mark} size={16} /> : <MemoIcon />}</span>
      <span className="sr-only">{mark ? SOURCE_NAME[mark] : "메모"}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {alias ? (
          // 별명이 있으면 별명 · 메모 줄마다 배지 — 배지 칸과 글 칸을 나눠 긴 글은 글 칸 안에서 줄바꿈 (68-8)
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-meta leading-normal">
            <Badge>별명</Badge>
            <span className="font-semibold break-words text-ink">{alias}</span>
            {text && (
              <>
                <Badge>메모</Badge>
                <p className={`break-words whitespace-pre-line text-ink-2 ${clamp ? "line-clamp-3" : ""}`}>{text}</p>
              </>
            )}
          </div>
        ) : (
          text && <p className={`text-meta leading-normal break-words whitespace-pre-line text-ink-2 ${clamp ? "line-clamp-3" : ""}`}>{text}</p>
        )}
        {caption && <span className="text-caption text-muted">{caption}</span>}
      </div>
    </div>
  );
}

// 배지를 글 첫 줄 높이에 맞춰 가운데
function Badge({ children }: { children: string }) {
  return (
    <span className="flex h-[1lh] items-center">
      <span className="flex h-[18px] items-center rounded-[5px] border border-line-strong bg-white px-1.5 text-[11px] font-semibold text-muted">{children}</span>
    </span>
  );
}

function MemoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
      <path d="M5 4h14v12l-4 4H5z" />
      <path d="M15 20v-4h4M8.5 9h7M8.5 12.5h4" />
    </svg>
  );
}
