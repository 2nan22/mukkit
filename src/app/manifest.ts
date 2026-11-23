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
    icons: [
      // 실행 화면(안드로이드)은 이 아이콘을 바탕색 위에 그린다 — 사각 아이콘이 붙어 보이지 않게 투명 바탕 심볼
      { src: "/splash-192.png", sizes: "192x192", type: "image/png" },
      { src: "/splash-512.png", sizes: "512x512", type: "image/png" },
      // 홈 화면 아이콘은 꽉 찬 앱 아이콘
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
