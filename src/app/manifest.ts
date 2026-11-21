import type { MetadataRoute } from "next";

// 홈 화면에 추가 — iPhone 은 홈 화면 앱에서만 웹 푸시를 받는다
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "마이슐랭",
    short_name: "마이슐랭",
    description: "믿을 만한 사람의 평가로 맛집을 고르세요",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
