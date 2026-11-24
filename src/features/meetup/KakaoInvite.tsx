"use client";

import { useState } from "react";
import { KakaoSymbol } from "@/components/brand/BrandLogo";

const SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

type KakaoSdk = { isInitialized(): boolean; init(key: string): void; Share: { sendDefault(o: object): void } };
declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

// 카카오 SDK — 누를 때만 받는다 (지도와 같은 JavaScript 키, 사이트 도메인은 이미 등록)
function loadKakao(): Promise<KakaoSdk> {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.crossOrigin = "anonymous";
    s.onload = () => (window.Kakao ? resolve(window.Kakao) : reject(new Error("no Kakao")));
    s.onerror = () => reject(new Error("load"));
    document.head.appendChild(s);
  });
}

// 약속 초대 (67) — 큰 버튼은 카카오톡 하나. 카카오 공유가 안 되면 휴대폰 공유 창, 그것도 없으면 복사
export function KakaoInvite({ url, title }: { url: string; title: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const text = `${title}, 어디서 만날지 같이 정해요`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했어요");
    } catch {
      setMessage(`복사하지 못했어요. 이 주소를 보내 주세요: ${url}`);
    }
  }

  async function kakao() {
    try {
      if (!KEY) throw new Error("no key");
      const k = await loadKakao();
      if (!k.isInitialized()) k.init(KEY);
      k.Share.sendDefault({ objectType: "text", text, link: { mobileWebUrl: url, webUrl: url }, buttonTitle: "약속 열기" });
    } catch {
      if (typeof navigator.share === "function") return navigator.share({ title, text, url }).catch(() => undefined);
      await copy();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={kakao} className="flex h-btn-l items-center justify-center gap-2 rounded-btn-l bg-[#FEE500] text-[16px] font-bold text-black/85 raised">
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
