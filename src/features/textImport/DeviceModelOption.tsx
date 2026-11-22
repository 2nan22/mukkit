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

// '더 꼼꼼하게 찾기' — 되는 기기에서만 보이고, 받은 뒤 켜 두면 글을 이 기기 안의 모델로도 읽는다
export function DeviceModelOption({ onChange }: { onChange: (enabled: boolean) => void }) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [on, setOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

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
    // 화면을 떠나면 그래픽 칩 메모리를 돌려준다
    return () => {
      live = false;
      abort.current?.abort();
      void releaseDeviceModel();
    };
  }, []);

  useEffect(() => onChange(state.kind === "saved" && on), [state.kind, on, onChange]);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(ON_KEY, next ? "on" : "off");
    } catch {}
  }

  async function download() {
    setError(null);
    const ctl = new AbortController();
    abort.current = ctl;
    let lock: { release(): Promise<void> } | null = null;
    try {
      lock = (await (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
    } catch {}
    setState({ kind: "downloading", received: 0 });
    let shown = 0;
    try {
      await downloadDeviceModel((received) => {
        // 1% 마다만 다시 그린다
        if (received - shown < MODEL_BYTES / 100) return;
        shown = received;
        setState({ kind: "downloading", received });
      }, ctl.signal);
      setOn(true);
      try {
        localStorage.setItem(ON_KEY, "on");
      } catch {}
      setState({ kind: "saved" });
    } catch (err) {
      setState({ kind: "absent" });
      if (ctl.signal.aborted) return;
      const quota = err instanceof DOMException && err.name === "QuotaExceededError";
      setError(quota ? `저장 공간이 모자라요. ${gb(MODEL_BYTES)} 이상 비운 뒤 다시 받아 주세요.` : "받기가 끊겼어요. 와이파이에서 다시 받아 주세요.");
    } finally {
      abort.current = null;
      await lock?.release().catch(() => {});
    }
  }

  async function remove() {
    if (!window.confirm(`받은 파일(${gb(MODEL_BYTES)})을 지울까요? 다시 쓰려면 처음부터 받아야 해요.`)) return;
    await removeDeviceModel();
    setState({ kind: "absent" });
  }

  if (state.kind === "checking" || state.kind === "unsupported") return null;

  return (
    <section aria-labelledby="device-model-title" className="flex flex-col gap-2 rounded-[14px] border border-line px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="device-model-title" className="text-body font-semibold text-ink">
          더 꼼꼼하게 찾기
        </h2>
        {state.kind === "saved" && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="device-model-title"
            onClick={toggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors before:absolute before:-inset-2 before:content-[''] ${on ? "bg-ink" : "bg-line-strong"}`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${on ? "left-[22px]" : "left-0.5"}`} />
          </button>
        )}
      </div>
      <p className="text-meta leading-normal text-muted">
        문장 속에 섞인 가게 이름까지 이 기기 안에서 찾아요. 글은 기기 밖으로 나가지 않아요.
      </p>

      {state.kind === "absent" && (
        <>
          <button
            type="button"
            onClick={download}
            className="mt-1 h-11 rounded-btn-m bg-surface text-body font-semibold text-ink"
          >
            {gb(MODEL_BYTES)} 받기
          </button>
          <span className="text-caption text-muted">처음 한 번만 받아요. 와이파이에서 받아 주세요.</span>
        </>
      )}

      {state.kind === "downloading" && (
        <div className="mt-1 flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-label="받는 중"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor((state.received / MODEL_BYTES) * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full bg-ink" style={{ width: `${Math.min(100, (state.received / MODEL_BYTES) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-muted">
              {gb(state.received)} / {gb(MODEL_BYTES)} · 받는 동안 이 화면을 켜 두세요
            </span>
            <button type="button" onClick={() => abort.current?.abort()} className="h-11 shrink-0 px-1 text-meta font-semibold text-ink">
              취소
            </button>
          </div>
        </div>
      )}

      {state.kind === "saved" && (
        <button type="button" onClick={remove} className="flex h-11 w-fit items-center text-caption text-muted underline underline-offset-[3px]">
          받은 파일 지우기 ({gb(MODEL_BYTES)})
        </button>
      )}

      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
