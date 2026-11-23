import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Suspense } from "react";
import { NavTracker } from "@/lib/nav/NavTracker";

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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Suspense fallback={null}>
          <NavTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
