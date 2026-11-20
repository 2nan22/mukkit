import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublicList } from "@/features/share/publicList";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";

export const alt = "마이슐랭 리스트";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontPath = join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf");

// 카카오톡 · 메신저 미리보기 — 리스트 이름 · 만든 사람 · 장소 수만 (메모 없음)
export default async function Image({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const [font, list] = await Promise.all([readFile(fontPath), getPublicList(createSupabaseAnonClient(), listId)]);
  const title = list?.name ?? "볼 수 없는 리스트";
  const sub = list ? `${list.ownerNickname}님의 리스트 · ${list.places.length}곳` : "마이슐랭";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#ffffff", color: "#17181c", fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: "#b93a06", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24 }}>3</div>
          <div style={{ fontSize: 32 }}>마이슐랭</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, lineHeight: 1.15, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 36, color: "#5b5f69" }}>{sub}</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Pretendard", data: font, weight: 700, style: "normal" }] },
  );
}
