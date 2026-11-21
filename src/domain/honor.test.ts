import { describe, expect, it } from "vitest";
import { honor } from "./honor";

describe("honor", () => {
  it("님을 한 번만 붙인다", () => {
    expect(honor("이난")).toBe("이난님");
    expect(honor("셋째손님")).toBe("셋째손님");
  });
});
