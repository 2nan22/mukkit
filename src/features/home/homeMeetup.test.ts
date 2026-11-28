import { describe, expect, it } from "vitest";
import { homeTiles, type HomeMeetup } from "./homeMeetup";

const none: HomeMeetup = { invites: { count: 0, meetupId: null, host: null }, next: null };
const now = new Date("2026-11-28T03:00:00Z").getTime();

describe("homeTiles", () => {
  it("기본은 뭐 먹지가 주황, 약속 잡기는 테두리", () => {
    const [eat, meet] = homeTiles({ meetup: none, wantToGo: 3, empty: false, now });
    expect([eat.primary, meet.primary]).toEqual([true, false]);
    expect(eat.sub).toBe("가고 싶은 곳에서 골라요");
    expect(meet).toMatchObject({ title: "약속 잡기", href: "/meet/new" });
  });
  it("답하지 않은 초대가 있으면 주황이 약속 칸으로", () => {
    const [eat, meet] = homeTiles({ meetup: { ...none, invites: { count: 1, meetupId: "m1", host: "민지" } }, wantToGo: 0, empty: false, now });
    expect([eat.primary, meet.primary]).toEqual([false, true]);
    expect(meet).toMatchObject({ title: "약속 초대 보기", sub: "민지님이 보냈어요", href: "/meet/m1" });
  });
  it("다음 약속 — 이름이 있으면 이름, 없으면 때로", () => {
    const next = { id: "m2", title: null, purpose: "meal" as const, startsAt: "2026-11-29T10:00:00Z", people: 3 };
    expect(homeTiles({ meetup: { ...none, next }, wantToGo: 0, empty: false, now })[1]).toMatchObject({ title: "내일 저녁 약속", sub: "7:00, 2명과 함께" });
    expect(homeTiles({ meetup: { ...none, next: { ...next, title: "팀 회식" } }, wantToGo: 0, empty: false, now })[1]).toMatchObject({ title: "팀 회식", sub: "내일 저녁 7:00, 2명과 함께" });
    expect(homeTiles({ meetup: { ...none, next: { ...next, startsAt: null, people: 1 } }, wantToGo: 0, empty: false, now })[1]).toMatchObject({ title: "식사 약속", sub: "시간 미정, 함께할 분 기다리는 중" });
  });
  it("저장 0곳이면 두 칸 모두 테두리 — 가져오기 카드가 주황", () => {
    const tiles = homeTiles({ meetup: { ...none, invites: { count: 1, meetupId: "m1", host: "민지" } }, wantToGo: 0, empty: true, now });
    expect(tiles.map((t) => t.primary)).toEqual([false, false]);
  });
});
