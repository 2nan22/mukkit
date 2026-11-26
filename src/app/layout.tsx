import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import { NavTracker } from "@/lib/nav/NavTracker";
import { NavLoading } from "@/lib/nav/NavLoading";
import { LaunchSplash, SPLASH_SCRIPT } from "@/components/brand/LaunchSplash";

// 아이패드 사파리는 맥처럼 알리므로 터치 수로 가른다
const IOS_SCRIPT = `try{var n=navigator;if(/iP(hone|ad|od)/.test(n.userAgent)||(/Macintosh/.test(n.userAgent)&&n.maxTouchPoints>1))document.documentElement.dataset.ios=""}catch(e){}`;

export const metadata: Metadata = {
  title: "먹킷",
  description: "광고도 별점 평균도 없는, 아는 사람들의 맛집 지도",
  // 홈 화면 앱 상태바는 default — 화면이 상태바 아래에서 시작한다. black-translucent 로 바꾸면 헤더가 상태바에 가리니
  // 그때는 모든 sticky top-0 헤더 · 실행 화면에 env(safe-area-inset-top) 을 더해야 한다 (68-3, viewportFit cover)
  appleWebApp: { capable: true, statusBarStyle: "default", title: "먹킷" },
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
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
        {/* 아이폰 · 아이패드 표시 — 입력칸 확대 막기(globals.css html[data-ios]) */}
        <script dangerouslySetInnerHTML={{ __html: IOS_SCRIPT }} />
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
