import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/features/auth/paths";
import { isLoginProvider, LOGIN_PICKER_PARAMS, toSupabaseProvider } from "@/features/auth/providers";

export async function GET(request: NextRequest, ctx: RouteContext<"/auth/login/[provider]">) {
  const { provider } = await ctx.params;
  if (!isLoginProvider(provider)) {
    return NextResponse.redirect(new URL("/?error=login", request.url));
  }

  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("next", next);
  callback.searchParams.set("via", provider);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: toSupabaseProvider(provider),
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true, queryParams: LOGIN_PICKER_PARAMS[provider] },
  });
  if (error || !data.url) {
    return NextResponse.redirect(new URL("/?error=login", request.url));
  }
  return NextResponse.redirect(data.url);
}
