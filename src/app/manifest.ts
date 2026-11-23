import type { MetadataRoute } from "next";

// 홈 화면에 추가 — iPhone 은 홈 화면 앱에서만 웹 푸시를 받는다
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "먹킷",
    short_name: "먹킷",
    description: "광고도 별점 평균도 없는, 아는 사람들의 맛집 지도",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ko",
    // 네이버 · 카카오 앱 공유 시트에서 먹킷으로 바로 보내기 (안드로이드 · 홈 화면에 추가한 앱)
    share_target: { action: "/import/share", method: "GET", params: { title: "title", text: "text", url: "url" } },
    icons: [
      // 실행 화면(안드로이드)은 큰 아이콘(512)을 바탕색 위에 그린다 — 빈 그림이라 흰 화면만 뜨고 심볼은 앱의 실행 애니메이션에서
      // 설치 안내 등 작은 자리는 192 를 쓴다 — 거기엔 심볼이 보이게
      { src: "/splash-192.png", sizes: "192x192", type: "image/png" },
      { src: "/splash-512.png", sizes: "512x512", type: "image/png" },
      // 홈 화면 아이콘은 꽉 찬 앱 아이콘
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
