import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Suspense } from "react";
import { NavTracker } from "@/lib/nav/NavTracker";
import { NavLoading } from "@/lib/nav/NavLoading";
import { LaunchSplash, SPLASH_SCRIPT } from "@/components/brand/LaunchSplash";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "먹킷",
  description: "광고도 별점 평균도 없는, 아는 사람들의 맛집 지도",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 아이폰 홈 막대 · 둥근 모서리 여백(env(safe-area-inset-*))을 쓰려면 cover 가 있어야 값이 들어온다 (68-3)
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-splash 는 그리기 전 스크립트가 붙인다 — 서버 그림과 달라도 경고하지 않게
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <LaunchSplash />
        <Suspense fallback={null}>
          <NavTracker />
          <NavLoading />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
