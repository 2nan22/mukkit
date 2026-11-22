"use client";

import { useEffect, useRef, useState } from "react";
import {
  deviceModelSaved,
  deviceModelSupported,
  downloadDeviceModel,
  MODEL_BYTES,
  releaseDeviceModel,
  removeDeviceModel,
} from "./deviceReader";

const ON_KEY = "mychelin-device-model-on";
const gb = (n: number) => `${(n / 1e9).toFixed(1)}GB`;

type State = { kind: "checking" | "unsupported" | "absent" | "saved" } | { kind: "downloading"; received: number };

// '문장 속 가게도 찾기' — 되는 기기에서만 보이고, 받은 뒤 켜 두면 글을 이 기기 안의 모델로도 읽는다
// busy: 글을 읽는 동안 켜기 · 지우기를 막는다
export function DeviceModelOption({ onChange, busy }: { onChange: (enabled: boolean) => void; busy: boolean }) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [on, setOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const abort = useRef<AbortController | null>(null);
  // 누른 버튼이 사라지면 다음 조작 자리로 포커스를 옮긴다
  const focusNext = useRef(false);
  const switchRef = useRef<HTMLButtonElement>(null);
  const getRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!(await deviceModelSupported())) return live && setState({ kind: "unsupported" });
      const saved = await deviceModelSaved();
      if (!live) return;
      let pref = true;
      try {
        pref = localStorage.getItem(ON_KEY) !== "off";
      } catch {}
      setOn(pref);
      setState({ kind: saved ? "saved" : "absent" });
    })();
    // 화면을 떠나면 받기를 멈추고 그래픽 칩 메모리를 돌려준다
    return () => {
      live = false;
      abort.current?.abort();
      void releaseDeviceModel();
    };
  }, []);

  useEffect(() => onChange(state.kind === "saved" && on), [state.kind, on, onChange]);

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    (state.kind === "saved" ? switchRef : state.kind === "downloading" ? cancelRef : getRef).current?.focus();
  }, [state.kind]);

  function save(next: boolean) {
    setOn(next);
    try {
      localStorage.setItem(ON_KEY, next ? "on" : "off");
    } catch {}
  }

  async function download() {
    setError(null);
    setNotice("");
    const ctl = new AbortController();
    abort.current = ctl;
    let lock: { release(): Promise<void> } | null = null;
    try {
      lock = (await (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
    } catch {}
    focusNext.current = true;
    setState({ kind: "downloading", received: 0 });
    let shown = 0;
    try {
      await downloadDeviceModel((received) => {
        // 1% 마다만 다시 그린다
        if (received - shown < MODEL_BYTES / 100) return;
        shown = received;
        setState({ kind: "downloading", received });
      }, ctl.signal);
      save(true);
      focusNext.current = true;
      setState({ kind: "saved" });
      setNotice("다 받았어요. 다음 찾기부터 문장 속 가게도 찾아요.");
    } catch (err) {
      focusNext.current = true;
      setState({ kind: "absent" });
      if (ctl.signal.aborted) return;
      const quota = err instanceof DOMException && err.name === "QuotaExceededError";
      setError(quota ? `저장 공간이 모자라요. ${gb(MODEL_BYTES)} 이상 비운 뒤 다시 받아 주세요.` : "받다가 끊겼어요. 와이파이를 확인하고 다시 받아 주세요.");
    } finally {
      abort.current = null;
      await lock?.release().catch(() => {});
    }
  }

  async function remove() {
    setConfirming(false);
    await removeDeviceModel();
    focusNext.current = true;
    setState({ kind: "absent" });
    setNotice("받은 파일을 지웠어요.");
  }

  if (state.kind === "checking" || state.kind === "unsupported") return null;

  return (
    <section aria-labelledby="device-model-title" className="flex flex-col gap-1 rounded-[14px] border border-line py-3 pr-3 pl-4">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="device-model-title" className="text-body font-semibold text-ink">
          문장 속 가게도 찾기
        </h2>
        {state.kind === "saved" && (
          <button
            ref={switchRef}
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="device-model-title"
            disabled={busy}
            onClick={() => save(!on)}
            className={`relative mr-1 h-7 w-12 shrink-0 rounded-full transition-colors before:absolute before:-inset-2 before:content-[''] disabled:opacity-50 ${on ? "bg-ink" : "bg-line-strong"}`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${on ? "left-[22px]" : "left-0.5"}`} />
          </button>
        )}
        {state.kind === "absent" && (
          <button ref={getRef} type="button" onClick={download} className="h-11 shrink-0 rounded-full bg-surface px-4 text-meta font-semibold text-ink">
            받기 · {gb(MODEL_BYTES)}
          </button>
        )}
      </div>
      <p className="pr-1 text-meta leading-normal text-muted">줄글 속에 섞인 가게 이름까지 찾아요.</p>

      {state.kind === "absent" && <p className="pr-1 text-caption text-muted">글을 읽는 데 필요한 파일이에요. 와이파이에서 한 번만 받아요.</p>}

      {state.kind === "downloading" && (
        <div className="mt-1.5 flex flex-col gap-1 pr-1">
          <div
            role="progressbar"
            aria-label="파일 받는 중"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor((state.received / MODEL_BYTES) * 100)}
            aria-valuetext={`${gb(MODEL_BYTES)} 중 ${gb(state.received)}`}
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full bg-ink" style={{ width: `${Math.min(100, (state.received / MODEL_BYTES) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-muted">
              {gb(state.received)} / {gb(MODEL_BYTES)} · 다 받을 때까지 이 화면에 있어 주세요
            </span>
            <button ref={cancelRef} type="button" onClick={() => abort.current?.abort()} className="h-11 shrink-0 px-1 text-meta font-semibold text-ink">
              취소
            </button>
          </div>
        </div>
      )}

      {state.kind === "saved" &&
        (confirming ? (
          <div className="flex items-center gap-1">
            <span className="mr-auto text-caption text-ink-2">받은 파일을 지울까요?</span>
            <button type="button" onClick={() => setConfirming(false)} className="h-11 shrink-0 px-2 text-meta text-muted">
              취소
            </button>
            <button type="button" onClick={remove} className="h-11 shrink-0 px-2 text-meta font-semibold text-danger">
              지우기
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="flex h-11 w-fit items-center text-caption text-muted underline underline-offset-[3px] disabled:opacity-50"
          >
            받은 파일 지우기 ({gb(MODEL_BYTES)})
          </button>
        ))}

      <p role="status" className={notice ? "pr-1 text-caption text-ink-2" : "sr-only"}>
        {notice}
      </p>
      {error && (
        <p role="alert" className="pr-1 text-meta text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
