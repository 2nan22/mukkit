"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const BUCKET = "rating-media";
const MAX_ITEMS = 10;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type Media = { id: string; path: string; kind: "image" | "video"; url: string | null };

// 사진은 브라우저에서 줄여 JPEG 로 다시 그린다 — 위치 등 촬영 정보(EXIF)도 이때 빠진다
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("사진 변환 실패"))), "image/jpeg", 0.85),
  );
}

export function MediaUploader({ userId, placeId }: { userId: string; placeId: string }) {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [items, setItems] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // 지우기 전에 한 번 묻는다 — 바로 지워지고 되돌릴 수 없어서 (77)
  const [confirm, setConfirm] = useState<Media | null>(null);
  // 추가 칸 label 은 relative — 숨은 파일 입력(sr-only, absolute)이 가로 스크롤 줄 밖으로 나가 화면이 옆으로 밀리던 것 (77)
  const confirmSheet = useRef<HTMLElement>(null);
  useEffect(() => {
    if (confirm) confirmSheet.current?.focus({ preventScroll: true });
  }, [confirm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("rating_media")
        .select("id, path, kind")
        .eq("user_id", userId)
        .eq("place_id", placeId)
        .order("created_at");
      const rows = (data ?? []) as Omit<Media, "url">[];
      const signed = rows.length ? await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600) : { data: [] };
      if (cancelled) return;
      setItems(rows.map((r, i) => ({ ...r, url: signed.data?.[i]?.signedUrl ?? null })));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, placeId]);

  async function add(files: FileList) {
    setError(null);
    const room = MAX_ITEMS - items.length;
    if (files.length > room) return setError(`사진과 영상은 한 평가에 ${MAX_ITEMS}개까지예요.`);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video/");
        if (isVideo && !VIDEO_TYPES.includes(file.type)) throw new Error("mp4, mov, webm 영상만 올릴 수 있어요.");
        if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error("영상은 30MB 까지예요.");
        const body = isVideo ? file : await toJpeg(file).catch(() => {
          throw new Error("이 사진 형식은 열 수 없어요. JPG나 PNG로 올려 주세요.");
        });
        const ext = isVideo ? (file.name.split(".").pop() ?? "mp4").toLowerCase() : "jpg";
        const path = `${userId}/${placeId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: isVideo ? file.type : "image/jpeg" });
        if (up.error) throw new Error("올리지 못했어요. 다시 시도해 주세요.");
        const kind = isVideo ? "video" : "image";
        const row = await supabase.from("rating_media").insert({ user_id: userId, place_id: placeId, path, kind }).select("id").single();
        if (row.error) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw new Error("올리지 못했어요. 다시 시도해 주세요.");
        }
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
        setItems((cur) => [...cur, { id: row.data.id as string, path, kind, url: signed.data?.signedUrl ?? null }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "올리지 못했어요.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  // 한 칸 앞으로 — 첫 사진이 대표(피드 · 장소 사진). 순서는 DB 함수가 created_at 으로 저장 (77)
  async function moveEarlier(i: number) {
    if (i <= 0) return;
    const next = [...items];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setBusy(true);
    const res = await supabase.rpc("reorder_my_media", { p_place: placeId, p_ids: next.map((m) => m.id) });
    if (res.error) setError("순서를 바꾸지 못했어요.");
    else {
      setError(null);
      setItems(next);
    }
    setBusy(false);
  }

  async function remove(m: Media) {
    setBusy(true);
    const del = await supabase.from("rating_media").delete().eq("id", m.id);
    if (!del.error) await supabase.storage.from(BUCKET).remove([m.path]);
    setItems((cur) => (del.error ? cur : cur.filter((x) => x.id !== m.id)));
    if (del.error) setError("지우지 못했어요.");
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-meta font-bold">사진과 영상</span>
      <div className="relative flex gap-2 overflow-x-auto pb-1">
        {items.map((m, i) => (
          <div key={m.id} className="relative size-20 shrink-0 overflow-hidden rounded-btn-m bg-surface">
            {m.url && m.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
              <img src={m.url} alt="" className="size-full object-cover" />
            )}
            {m.url && m.kind === "video" && <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />}
            {m.kind === "video" && (
              <span aria-hidden="true" className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">
                영상
              </span>
            )}
            {items.length > 1 && i === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-ink px-1 text-[10px] font-bold text-white">대표</span>
            )}
            {i > 0 && (
              <button
                type="button"
                onClick={() => moveEarlier(i)}
                disabled={busy}
                aria-label={`${i + 1}번째 사진을 앞으로`}
                className="absolute bottom-0.5 left-0.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirm(m)}
              disabled={busy}
              aria-label="사진이나 영상 삭제"
              className="absolute top-0.5 right-0.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
        {items.length < MAX_ITEMS && (
          <label className={`relative flex size-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-btn-m border border-dashed border-line-strong text-caption text-muted ${busy ? "opacity-50" : ""}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {busy ? "올리는 중" : "추가"}
            <input
              ref={input}
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm"
              multiple
              disabled={busy}
              onChange={(e) => e.target.files && add(e.target.files)}
              className="sr-only"
            />
          </label>
        )}
      </div>
      <span className="text-caption text-muted">{items.length > 1 ? "첫 사진이 대표 사진이에요. ‹ 를 누르면 앞으로 옮겨요" : "위치 정보는 지우고 올려요"}</span>
      {confirm &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={() => setConfirm(null)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="media-del-title"
              tabIndex={-1}
              ref={confirmSheet}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === "Escape" && setConfirm(null)}
              className="flex w-full max-w-[480px] flex-col gap-1 rounded-t-[20px] bg-white px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none"
            >
              <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
              <h2 id="media-del-title" className="pt-3 text-section font-bold">
                {confirm.kind === "video" ? "이 영상을 지울까요?" : "이 사진을 지울까요?"}
              </h2>
              <p className="pb-2 text-meta text-muted">지우면 되돌릴 수 없어요</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const m = confirm;
                  setConfirm(null);
                  void remove(m);
                }}
                className="flex h-12 items-center text-body font-semibold text-danger disabled:opacity-50"
              >
                지우기
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="flex h-12 items-center text-body text-ink">
                닫기
              </button>
            </section>
          </div>,
          document.body,
        )}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
