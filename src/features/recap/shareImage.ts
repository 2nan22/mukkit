import { CUISINE_LABEL } from "@/domain/cuisine";
import { CHOPSTICKS, SPOON_HEAD, SPOON_STICK } from "@/components/brand/Wordmark";
import type { Recap } from "./recap";

// 결산 공유 이미지 (94) — 세로 9:16 한 장을 기기에서 그린다 (서버에 올리지 않음)
// 동네 · 함께 간 사람은 켤 때만 · '나만' 공개로 매긴 곳은 넣지 않는다
export type ShareOptions = { regions: boolean; people: boolean };

const W = 1080;
const H = 1920;
const PAD = 96;
const FONT = '"Pretendard Variable", "Apple SD Gothic Neo", system-ui, sans-serif';
const BG = "#17181c";
const SOFT = "rgba(255,255,255,0.62)";
// 칸 이름은 브랜드 주황 — 어두운 바탕 위 큰 글자(34px 이상)라 대비 3:1 넘음
const ACCENT = "#e0561c";
const BRAND = "#c8410b";

type Section = { label: string; items: string[] };

export function shareSections(r: Recap, o: ShareOptions): Section[] {
  const out: Section[] = [];
  if (r.cuisines.length) out.push({ label: "많이 찾은 음식 종류", items: r.cuisines.map((c) => CUISINE_LABEL[c.cuisine]) });
  const shown = r.ranking.filter((p) => !p.isPrivate);
  // 가게 전체 순위로 읽히지 않게 '내가 매긴' 을 칸 이름에 (94 디자인 검토)
  if (shown.length) out.push({ label: "내가 매긴 3숟가락 순위", items: shown.map((p, i) => `${i + 1}  ${p.name}`) });
  if (o.regions && r.regions.length) out.push({ label: "많이 간 동네", items: r.regions.map((g) => g.region) });
  if (o.people && r.companions.length) out.push({ label: "함께 많이 간 사람", items: r.companions.map((c) => c.name) });
  return out;
}

// 넘치는 글은 말줄임
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export async function drawShareImage(canvas: HTMLCanvasElement, r: Recap, o: ShareOptions): Promise<void> {
  const sections = shareSections(r, o);
  const sample = [`${r.year} 먹킷 결산`, "올해 등급을 매긴 곳", `${r.rated}곳`, "먹킷 MUKKIT 아는 사람의 맛집 지도", ...sections.flatMap((s) => [s.label, ...s.items])].join("");
  // 글꼴은 글자 묶음별로 받아 오므로 그리기 전에 쓸 글자를 불러 둔다
  try {
    await Promise.all([document.fonts.load(`700 48px ${FONT}`, sample), document.fonts.load(`500 48px ${FONT}`, sample)]);
  } catch {
    // 못 받으면 기본 글꼴로 그린다
  }
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // 인스타그램 스토리 위쪽(약 250px)은 앱 화면이 덮으므로 머리는 그 아래부터
  text(ctx, `${r.year} 먹킷 결산`, PAD, 330, 40, 700, SOFT);
  text(ctx, "올해 등급을 매긴 곳", PAD, 440, 46, 500, SOFT);
  text(ctx, `${r.rated.toLocaleString("ko-KR")}곳`, PAD - 6, 600, 168, 800, "#ffffff");

  // 칸이 넷이면 줄을 좁혀 아래 로고(1720 위)에서 끝나게
  const dense = sections.length > 3;
  let y = dense ? 730 : 750;
  for (const s of sections) {
    text(ctx, s.label, PAD, y, dense ? 34 : 38, 700, ACCENT);
    y += dense ? 56 : 72;
    for (const item of s.items) {
      ctx.font = `600 ${dense ? 46 : 52}px ${FONT}`;
      text(ctx, fit(ctx, item, W - PAD * 2), PAD, y, dense ? 46 : 52, 600, "#ffffff");
      y += dense ? 54 : 66;
    }
    y += dense ? 26 : 44;
  }

  // 아래 — 주황 수저 심볼 + 먹킷 · MUKKIT + 태그라인
  drawSymbol(ctx, PAD, H - 236, 112);
  const lx = PAD + 100;
  text(ctx, "먹킷", lx, H - 168, 60, 800, "#ffffff");
  ctx.font = `800 60px ${FONT}`;
  const brandW = ctx.measureText("먹킷").width;
  text(ctx, "MUKKIT", lx + brandW + 16, H - 170, 30, 700, SOFT);
  text(ctx, "아는 사람의 맛집 지도", lx, H - 120, 34, 500, SOFT);
}

// 글자 — 큰 글자는 자간을 좁힌다 (18px 이상 -0.02em 규칙, 지원하는 브라우저만)
function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, weight: number, color: string) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(-0.02 * size).toFixed(1)}px`;
  ctx.fillText(t, x, y);
}

// 수저 심볼 — 글자 로고와 같은 도형 (components/brand/Wordmark)
function drawSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, height: number) {
  const k = height / 780;
  ctx.save();
  ctx.translate(x - 220 * k, y - 120 * k);
  ctx.scale(k, k);
  ctx.fillStyle = BRAND;
  ctx.fill(new Path2D(SPOON_STICK));
  ctx.beginPath();
  ctx.ellipse(SPOON_HEAD.cx, SPOON_HEAD.cy, SPOON_HEAD.rx, SPOON_HEAD.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const d of CHOPSTICKS) ctx.fill(new Path2D(d));
  ctx.restore();
}

// 저장 — 공유 시트로 파일을 보낼 수 있으면 그것으로, 아니면 내려받기
export async function saveShareImage(canvas: HTMLCanvasElement, year: number): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("이미지를 만들지 못했어요");
  const file = new File([blob], `mukkit-${year}.png`, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
