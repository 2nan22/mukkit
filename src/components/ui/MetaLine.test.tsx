import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetaLine } from "./MetaLine";

describe("MetaLine (68-6)", () => {
  it("빈 값은 건너뛰고 사이에만 세로선", () => {
    const { container } = render(<MetaLine items={["한식", null, "", false, "성수동"]} />);
    expect(container.textContent).toBe("한식, 성수동");
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });
  it("한 줄일 때 마지막 항목만 말줄임", () => {
    const { container } = render(<MetaLine items={["1.2km", "아주 긴 주소"]} />);
    const spans = [...container.querySelectorAll("span > span:not([aria-hidden]):not(.sr-only)")];
    expect(spans[0].className).toContain("shrink-0");
    expect(spans.at(-1)!.className).toContain("truncate");
  });
});
