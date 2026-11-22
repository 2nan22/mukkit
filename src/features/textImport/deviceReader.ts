// 글에서 가게 이름을 이 기기 안에서 읽는 모델 — 글은 기기 밖으로 나가지 않는다
// 교체 지점: 지금은 Gemma 4 E2B + LiteRT-LM Web(WebGPU). 네이티브 앱으로 감싸면 기기 내장 모델 구현으로 이 파일만 바꾼다
// 실기기 기록 · 선택 이유는 .claude/prompts/_complete/31_device_model.md
import type { Conversation, Engine } from "@litert-lm/core";
import { parseModelNames } from "@/domain/textPlaces";

// 저장소 커밋 고정 — 파일이 바뀌어도 받은 것과 같은 모델을 쓴다
const MODEL_URL =
  "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/2e12bfd869b2962984f97a1f2a26807316d534cc/gemma-4-E2B-it-gpu.litertlm";
export const MODEL_BYTES = 2_340_870_772;
const CACHE = "mychelin-device-model";

const PROMPT = `다음은 인스타그램 · 블로그 · 유튜브에 올라온 한국어 글이다. 글쓴이가 직접 다녀왔거나 소개한 가게(식당 · 카페 · 술집)의 이름만 뽑아라.
- 메뉴 이름, 가격, 동네 · 지역 이름, 역 이름, 해시태그의 일반어(맛집 · 데이트 등)는 가게가 아니다.
- 지점명이 적혀 있으면 이름에 포함한다.
- 가게가 없으면 빈 배열.
JSON 만 답하라: {"places":[{"name":"..."}]}

글:
`;

// WebGPU 가 있고 소프트웨어 대체가 아닌 그래픽 칩일 때만 — 안 되면 화면에 기능을 보이지 않는다
export async function deviceModelSupported(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator) || typeof caches === "undefined") return false;
  try {
    const gpu = (navigator as Navigator & { gpu: { requestAdapter(): Promise<{ info?: { isFallbackAdapter?: boolean } } | null> } }).gpu;
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter) && !adapter?.info?.isFallbackAdapter;
  } catch {
    return false;
  }
}

// 항목 하나가 크면 저장하지 못하는 브라우저가 있어 조각으로 나눠 저장
// (맥 Chromium 기반 브라우저에서 256MB 항목부터 실패 · 200MB 까지 성공 확인)
const PART = 128 * 1024 * 1024;
const partUrl = (i: number) => `${MODEL_URL}?part=${i}`;
// 조각을 다 쓴 뒤 마지막에 쓴다 — 이것이 있어야 '받음'
const MANIFEST = `${MODEL_URL}?manifest`;

export async function deviceModelSaved(): Promise<boolean> {
  try {
    return Boolean(await (await caches.open(CACHE)).match(MANIFEST));
  } catch {
    return false;
  }
}

// 받아서 조각으로 기기에 저장 — 중간에 끊기면 남은 조각을 지운다
export async function downloadDeviceModel(onProgress: (received: number) => void, signal: AbortSignal): Promise<void> {
  await caches.delete(CACHE);
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(MODEL_URL, { signal });
    if (!res.ok || !res.body) throw new Error(`model download ${res.status}`);
    const reader = res.body.getReader();
    let received = 0;
    let carry: Uint8Array | null = null;
    let ended = false;
    let parts = 0;
    while (!ended) {
      let size = 0;
      const part = new ReadableStream<Uint8Array>({
        async pull(ctl) {
          if (size >= PART) return ctl.close();
          let chunk = carry;
          carry = null;
          if (!chunk) {
            const r = await reader.read();
            if (r.done) {
              ended = true;
              return ctl.close();
            }
            chunk = r.value;
            received += chunk.byteLength;
            onProgress(received);
          }
          // 경계에서 자른 나머지는 복사해 둔다 — 저장하면서 넘겨진 메모리를 함께 쓰지 않게
          if (chunk.byteLength > PART - size) {
            carry = chunk.slice(PART - size);
            chunk = chunk.slice(0, PART - size);
          }
          size += chunk.byteLength;
          ctl.enqueue(chunk);
        },
      });
      await cache.put(partUrl(parts), new Response(part));
      if (size === 0) await cache.delete(partUrl(parts));
      else parts += 1;
    }
    if (received !== MODEL_BYTES) throw new Error(`model size ${received}`);
    await cache.put(MANIFEST, new Response(JSON.stringify({ parts })));
  } catch (err) {
    await caches.delete(CACHE).catch(() => false);
    throw err;
  }
  // 공간이 모자랄 때 브라우저가 먼저 지우지 않게 (거절돼도 동작에는 상관없음)
  await navigator.storage?.persist?.().catch(() => false);
}

// 저장한 조각을 차례로 이어 하나의 흐름으로
async function savedModelStream(): Promise<ReadableStream<Uint8Array>> {
  const cache = await caches.open(CACHE);
  const manifest = await cache.match(MANIFEST);
  if (!manifest) throw new Error("model not saved");
  const { parts } = (await manifest.json()) as { parts: number };
  let next = 0;
  let cur: ReadableStreamDefaultReader<Uint8Array> | null = null;
  return new ReadableStream<Uint8Array>({
    async pull(ctl) {
      for (;;) {
        if (!cur) {
          if (next >= parts) return ctl.close();
          const r = await cache.match(partUrl(next++));
          if (!r?.body) throw new Error("model part missing");
          cur = r.body.getReader();
        }
        const x = await cur.read();
        if (x.done) {
          cur = null;
          continue;
        }
        ctl.enqueue(x.value);
        return;
      }
    },
  });
}

let engine: Promise<Engine> | null = null;

function loadEngine(): Promise<Engine> {
  engine ??= (async () => {
    const model = await savedModelStream();
    const { Engine } = await import("@litert-lm/core");
    return Engine.create({ model });
  })().catch((err) => {
    engine = null;
    throw err;
  });
  return engine;
}

// 그래픽 칩 메모리를 돌려준다 — 화면을 떠날 때 · 모델을 지울 때
export async function releaseDeviceModel(): Promise<void> {
  const e = engine;
  engine = null;
  await e?.then((x) => x.delete()).catch(() => {});
}

export async function removeDeviceModel(): Promise<void> {
  await releaseDeviceModel();
  await caches.delete(CACHE);
}

// 글 하나에서 가게 이름들 — 대화는 글마다 새로 열고 바로 닫는다(쌓이면 탭이 메모리 부족으로 죽음, 실기기 확인)
export async function readPlaceNames(text: string): Promise<string[]> {
  const e = await loadEngine();
  const chat: Conversation = await e.createConversation();
  try {
    const res = await chat.sendMessage(PROMPT + text);
    const content = res.content;
    const raw = typeof content === "string" ? content : (content ?? []).map((p) => ("text" in p && typeof p.text === "string" ? p.text : "")).join("");
    return parseModelNames(raw);
  } finally {
    await chat.delete().catch(() => {});
  }
}
