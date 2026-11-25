import { SourceMark, type MemoSource } from "@/components/brand/BrandLogo";

type Audience = "private" | "followers" | "public";
const AUDIENCE_LABEL: Record<Audience, string> = { public: "전체 공개", followers: "팔로워 공개", private: "비공개" };

const SOURCE_NAME: Record<MemoSource, string> = { naver: "네이버 지도 메모", kakao: "카카오맵 메모", google: "구글 지도 메모" };

// 메모 한 칸 — 왼쪽 아이콘(지도 앱에서 가져온 메모면 그 앱 로고, 아니면 메모 아이콘) · 오른쪽 내용 (68-6)
// 가운데 점으로 이름표와 내용을 한 줄에 잇지 않는다. audience: 내 메모를 실제로 누가 보는지 — 눈 아이콘 + 전체 공개 · 팔로워 공개 · 비공개 (내 화면에서만, 68-10)
// alias: 지도 앱 별명 — 메모와 따로 '별명' 배지 줄 (68-7) · 메모 줄은 늘 '메모' 배지 (68-8 · 68-10)
export function Memo({ text, alias, source, audience, tone = "surface", clamp }: { text: string; alias?: string; source?: string | null; audience?: Audience; tone?: "surface" | "white"; clamp?: 3 }) {
  // 별명만 있으면 별명이 온 네이버 로고 (별명은 네이버에만 있음)
  const mark = source === "naver" || source === "kakao" || source === "google" ? source : alias && !text ? "naver" : null;
  return (
    <div className={`flex gap-2.5 rounded-btn-s px-3 py-2.5 ${tone === "white" ? "bg-white" : "bg-surface"}`}>
      {/* 아이콘을 첫 줄 높이(1lh)에 맞춰 가운데 — 글 첫 줄과 나란히 */}
      <span className="flex h-[1lh] shrink-0 items-center text-meta leading-normal">{mark ? <SourceMark source={mark} size={16} /> : <MemoIcon />}</span>
      <span className="sr-only">{mark ? (text ? SOURCE_NAME[mark] : SOURCE_NAME[mark].replace("메모", "별명")) : "메모"}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* 별명 · 메모 줄마다 배지 — 메모는 별명이 없어도 늘 (68-10). 배지 칸과 글 칸을 나눠 긴 글은 글 칸 안에서 줄바꿈 */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-meta leading-normal">
          {alias && (
            <>
              <Badge>별명</Badge>
              <span className={`font-semibold break-words text-ink ${clamp ? "line-clamp-2" : ""}`}>{alias}</span>
            </>
          )}
          {text && (
            <>
              <Badge>메모</Badge>
              <p className={`break-words whitespace-pre-line text-ink-2 ${clamp ? "line-clamp-3" : ""}`}>{text}</p>
            </>
          )}
        </div>
        {audience && (
          <span className="flex items-center gap-1 text-caption text-muted">
            <EyeIcon off={audience === "private"} />
            <span className="sr-only">메모 공개 범위 </span>
            {AUDIENCE_LABEL[audience]}
          </span>
        )}
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

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
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
