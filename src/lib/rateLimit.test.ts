import { describe, expect, it } from "vitest";
import { allowCall } from "./rateLimit";

describe("allowCall", () => {
  it("구간 안 한도를 넘으면 막고, 구간이 지나면 다시 허용한다", () => {
    const key = `t-${Math.random()}`;
    expect([0, 1, 2].map((i) => allowCall(key, 2, 1000, 10_000 + i))).toEqual([true, true, false]);
    expect(allowCall(key, 2, 1000, 11_001)).toBe(true);
  });
});
