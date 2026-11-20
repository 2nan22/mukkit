import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StartPage from "./page";
import { LoginErrorNotice } from "@/features/onboarding/LoginErrorNotice";

describe("시작하기 화면", () => {
  it("카카오 · 구글 · 네이버 모두 로그인 라우트로 간다", () => {
    render(<StartPage params={Promise.resolve({})} searchParams={Promise.resolve({})} />);
    expect(screen.getByRole("link", { name: /카카오로 시작하기/ }).getAttribute("href")).toBe("/auth/login/kakao");
    expect(screen.getByRole("link", { name: /구글로 시작하기/ }).getAttribute("href")).toBe("/auth/login/google");
    expect(screen.getByRole("link", { name: /네이버로 시작하기/ }).getAttribute("href")).toBe("/auth/login/naver");
  });
});

describe("LoginErrorNotice", () => {
  it("로그인 실패로 돌아왔을 때만 안내를 보인다", async () => {
    const { unmount } = render(await LoginErrorNotice({ searchParams: Promise.resolve({ error: "login" }) }));
    expect(screen.getByRole("alert").textContent).toContain("로그인에 실패했어요");
    unmount();

    expect(await LoginErrorNotice({ searchParams: Promise.resolve({}) })).toBeNull();
  });
});
