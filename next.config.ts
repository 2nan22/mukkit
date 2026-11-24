import type { NextConfig } from "next";

// 버전 — 날짜 버전(CalVer YY.M.D, 한국 시각 빌드 날짜) + 빌드(커밋 앞 7자리) (65)
// 앱 스토어 버전 형식(정수 세 마디)과 맞춤 · 같은 날 여러 번 배포하면 빌드로 구분
const kst = new Date(Date.now() + 9 * 3600_000);
const APP_VERSION = `${kst.getUTCFullYear() % 100}.${kst.getUTCMonth() + 1}.${kst.getUTCDate()}`;
const APP_BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION, NEXT_PUBLIC_APP_BUILD: APP_BUILD },
  cacheComponents: true,
  devIndicators: false,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
