"use client";

import { useEffect, useState } from "react";
import { KakaoSymbol } from "@/components/brand/BrandLogo";

const SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
const LOAD_MS = 5000;

type KakaoSdk = { isInitialized(): boolean; init(key: string): void; Share: { sendDefault(o: object): unknown } };
declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

// 카카오 SDK — 화면이 열릴 때 미리 받아 둔다(누른 뒤 기다리면 휴대폰 공유 창이 막힘). 한 번만 · 5초 제한 · 실패하면 다음에 다시
let loading: Promise<KakaoSdk> | null = null;
function loadKakao(): Promise<KakaoSdk> {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  loading ??= new Promise<KakaoSdk>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.crossOrigin = "anonymous";
    const fail = () => {
      s.remove();
      loading = null;
      reject(new Error("kakao sdk"));
    };
    const timer = window.setTimeout(fail, LOAD_MS);
    s.onload = () => {
      window.clearTimeout(timer);
      if (window.Kakao) resolve(window.Kakao);
      else fail();
    };
    s.onerror = () => {
      window.clearTimeout(timer);
      fail();
    };
    document.head.appendChild(s);
  });
  return loading;
}

// 약속 초대 (67) — 큰 버튼은 카카오톡 하나. 카카오 공유가 준비 안 됐으면 휴대폰 공유 창, 그것도 없으면 복사
export function KakaoInvite({ url, title }: { url: string; title: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [kakao, setKakao] = useState<KakaoSdk | null>(null);
  const text = `${title}, 어디서 만날지 같이 정해요`;

  useEffect(() => {
    if (!KEY) return;
    let alive = true;
    loadKakao()
      .then((k) => {
        if (!k.isInitialized()) k.init(KEY);
        if (alive) setKakao(k);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했어요");
    } catch {
      setMessage(`복사하지 못했어요. 이 주소를 보내 주세요: ${url}`);
    }
  }

  // 누른 자리에서 바로 — 사이에 기다림이 없어야 공유 창이 열린다
  function send() {
    if (kakao) {
      try {
        void Promise.resolve(kakao.Share.sendDefault({ objectType: "text", text, link: { mobileWebUrl: url, webUrl: url }, buttonTitle: "약속 열기" })).catch(() => copy());
        return;
      } catch {
        // 아래 공유 창으로
      }
    }
    if (typeof navigator.share === "function") {
      navigator.share({ title, text, url }).catch((e: unknown) => {
        // 사용자가 닫은 것(AbortError)은 그대로, 그 밖은 복사로
        if (!(e instanceof DOMException && e.name === "AbortError")) void copy();
      });
      return;
    }
    void copy();
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={send} className="flex h-btn-l items-center justify-center gap-2 rounded-btn-l bg-[#FEE500] text-[16px] font-bold text-black/85 raised">
        <KakaoSymbol />
        카카오톡으로 초대하기
      </button>
      <button type="button" onClick={copy} className="h-11 text-meta font-semibold text-ink-2 underline underline-offset-[3px]">
        링크 복사
      </button>
      {message && (
        <p role="status" className="break-all text-center text-meta text-ink-2">
          {message}
        </p>
      )}
    </div>
  );
}
