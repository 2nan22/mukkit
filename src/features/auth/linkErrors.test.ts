import { describe, expect, it } from "vitest";
import { linkErrorMessage } from "./linkErrors";

describe("linkErrorMessage", () => {
  it("이미 다른 계정에 연결된 경우를 구분해 안내", () => {
    expect(linkErrorMessage("identity_already_exists")).toContain("이미 다른 마이슐랭 계정");
    expect(linkErrorMessage("last_identity")).toContain("하나뿐");
  });

  it("모르는 코드는 일반 문구, 없으면 null", () => {
    expect(linkErrorMessage("something_else")).toBe("연결하지 못했어요. 다시 시도해 주세요.");
    expect(linkErrorMessage(undefined)).toBeNull();
  });
});
