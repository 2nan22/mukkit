"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "./actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State = "loading" | "hidden" | "ios-install" | "unsupported" | "denied" | "off" | "on";

function toKey(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

async function readState(): Promise<State> {
  if (!PUBLIC_KEY) return "hidden";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return (await currentSubscription()) ? "on" : "off";
}

const DISMISS_KEY = "push-strip-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// 알림 켜기 — strip: 약속 화면 · 목록의 한 줄 안내(켜져 있거나 닫으면 숨김) · row: 설정 › 알림(끄기 포함)
export function PushToggle({ variant, text }: { variant: "strip" | "row"; text?: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    readState().then((s) => {
      if (!alive) return;
      setDismissed(readDismissed());
      setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") {
          setState("denied");
          setNotice("알림이 차단돼 있어요. 브라우저 설정에서 허용할 수 있어요.");
        }
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(PUBLIC_KEY) }));
      const res = await savePushSubscription(sub.toJSON());
      if (res.error) {
        setError(res.error);
        return;
      }
      setState("on");
      if (variant === "strip") setNotice("알림을 켰어요. 설정에서 끌 수 있어요.");
    } catch {
      setError("알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("알림을 끄지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 저장하지 못하면 이번 화면에서만 닫힘
    }
  }

  if (state === "loading" || state === "hidden") return null;

  if (variant === "strip") {
    if (notice) {
      return (
        <p role="status" className="flex min-h-12 items-center rounded-[16px] bg-surface px-4 text-meta text-ink-2">
          {notice}
        </p>
      );
    }
    if (dismissed || (state !== "off" && state !== "ios-install")) return null;
    return (
      <div className="flex min-h-12 items-center gap-1 rounded-[16px] bg-surface py-1.5 pl-4">
        <span className="flex flex-1 flex-col gap-0.5 py-1">
          {state === "ios-install" ? (
            <>
              <span className="text-meta text-ink-2">iPhone은 홈 화면에 추가하면 알림을 받을 수 있어요</span>
              <span className="text-caption text-muted">Safari 공유 버튼 › 홈 화면에 추가</span>
            </>
          ) : (
            <span className="text-meta text-ink-2">{error ?? text ?? "다른 분이 참여하면 알림으로 알려 드려요"}</span>
          )}
        </span>
        {state === "off" && (
          <button type="button" disabled={busy} onClick={turnOn} className="h-10 shrink-0 px-2 text-meta font-semibold text-ink disabled:opacity-50">
            {busy ? "켜는 중…" : "알림 켜기"}
          </button>
        )}
        <button type="button" aria-label="닫기" onClick={dismiss} className="flex size-11 shrink-0 items-center justify-center text-subtle">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  const hint =
    state === "on"
      ? "이 기기에서 알림을 받고 있어요"
      : state === "denied"
        ? "브라우저 설정에서 먹킷 알림을 허용해 주세요"
        : state === "ios-install"
          ? "Safari 공유 버튼 › 홈 화면에 추가한 뒤 켤 수 있어요"
          : state === "unsupported"
            ? "이 브라우저에서는 알림을 받을 수 없어요"
            : "약속 · 댓글 · 함께 방문 소식을 알려 드려요";
  const canToggle = state === "on" || state === "off";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-16 items-center gap-3 border-b border-line">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-body font-bold">이 기기에서 알림 받기</span>
          {error ? (
            <span role="alert" className="text-meta text-danger">
              {error}
            </span>
          ) : (
            <span className="text-meta text-muted">{hint}</span>
          )}
        </span>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={state === "on"}
            aria-label="이 기기에서 알림 받기"
            disabled={busy}
            onClick={state === "on" ? turnOff : turnOn}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors before:absolute before:-inset-2 before:content-[''] disabled:opacity-50 ${state === "on" ? "bg-ink" : "bg-line-strong"}`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${state === "on" ? "left-[22px]" : "left-0.5"}`} />
          </button>
        )}
      </div>
    </div>
  );
}
