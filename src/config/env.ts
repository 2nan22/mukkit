import { z } from "zod";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

export class MissingEnvError extends Error {
  constructor(readonly keys: string[]) {
    super(`필수 환경변수 누락 · 형식 오류: ${keys.join(", ")} (.env.example 참고)`);
    this.name = "MissingEnvError";
  }
}

// NEXT_PUBLIC_ 값은 빌드 시 글자 그대로 치환되므로 키를 하나씩 직접 적는다
export function readPublicEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): PublicEnv {
  const parsed = PublicEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new MissingEnvError([...new Set(parsed.error.issues.map((i) => String(i.path[0])))]);
  }
  return parsed.data;
}
