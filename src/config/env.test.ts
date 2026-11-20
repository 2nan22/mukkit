import { describe, expect, it } from "vitest";
import { MissingEnvError, readPublicEnv } from "./env";

describe("readPublicEnv", () => {
  it("필수 키가 비면 어떤 키인지 담아 실패한다", () => {
    const error = (() => {
      try {
        readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(MissingEnvError);
    expect((error as MissingEnvError).keys.sort()).toEqual([
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  });

  it("값이 있으면 그대로 돌려준다", () => {
    expect(
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
  });
});
