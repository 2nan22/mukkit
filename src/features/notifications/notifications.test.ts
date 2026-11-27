import { describe, expect, it } from "vitest";
import { groupNotifications, type AppNotification } from "./notifications";

const base: Omit<AppNotification, "id" | "kind" | "actorId" | "createdAt"> = {
  actorNickname: "a", ownerId: "me", placeId: "p1", placeName: "가게", meetupId: null, visitId: null, read: true, pointKind: null, firstReady: false, meetupStartsAt: null,
};
const n = (id: string, kind: AppNotification["kind"], actorId: string, extra: Partial<AppNotification> = {}): AppNotification => ({ ...base, id, kind, actorId, createdAt: "2026-11-23T00:00:00Z", ...extra });

describe("groupNotifications", () => {
  it("같은 평가의 댓글은 한 줄 · 다른 사람 수를 센다 · 하나라도 안 읽었으면 안 읽음", () => {
    const g = groupNotifications([n("1", "comment", "x"), n("2", "comment", "x", { read: false }), n("3", "comment", "y"), n("4", "like", "x"), n("5", "follow", "x")]);
    expect(g.map((r) => [r.id, r.count, r.otherActors, r.read])).toEqual([
      ["1", 3, 1, false],
      ["4", 1, 0, true],
      ["5", 1, 0, true],
    ]);
  });
  it("다른 평가는 묶지 않는다", () => {
    expect(groupNotifications([n("1", "like", "x"), n("2", "like", "x", { placeId: "p2" })])).toHaveLength(2);
  });
});
