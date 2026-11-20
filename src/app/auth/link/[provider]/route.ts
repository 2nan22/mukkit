import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACCOUNT_LINKS, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { isLoginProvider, toSupabaseProvider } from "@/features/auth/providers";

// 로그인한 사용자에게 다른 소셜 계정을 덧붙인다 — 콜백은 로그인과 같은 /auth/callback
export async function GET(request: NextRequest, ctx: RouteContext<"/auth/link/[provider]">) {
  const { provider } = await ctx.params;
  const back = new URL(ACCOUNT_LINKS, request.url);
  if (!isLoginProvider(provider)) {
    back.searchParams.set("error", "unknown_provider");
    return NextResponse.redirect(back);
  }

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.redirect(new URL(SIGNED_OUT_HOME, request.url));

  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("next", ACCOUNT_LINKS);
  const { data, error } = await supabase.auth.linkIdentity({
    provider: toSupabaseProvider(provider),
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    back.searchParams.set("error", error?.code ?? "link_failed");
    return NextResponse.redirect(back);
  }
  return NextResponse.redirect(data.url);
}
