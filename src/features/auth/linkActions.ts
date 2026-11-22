"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACCOUNT_LINKS } from "./paths";
import { fromSupabaseProvider, isLoginProvider } from "./providers";

// 연결된 로그인 하나를 끊는다 — 마지막 하나는 끊지 않는다 (로그인할 방법이 없어짐)
export async function unlinkProvider(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!isLoginProvider(provider)) redirect(`${ACCOUNT_LINKS}?error=unknown_provider`, RedirectType.replace);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data) redirect(`${ACCOUNT_LINKS}?error=unlink_failed`, RedirectType.replace);

  const identities = data.identities;
  const target = identities.find((identity) => fromSupabaseProvider(identity.provider) === provider);
  if (!target) redirect(ACCOUNT_LINKS, RedirectType.replace);
  if (identities.length <= 1) redirect(`${ACCOUNT_LINKS}?error=last_identity`, RedirectType.replace);

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(target);
  if (unlinkError) redirect(`${ACCOUNT_LINKS}?error=${unlinkError.code ?? "unlink_failed"}`, RedirectType.replace);

  revalidatePath(ACCOUNT_LINKS);
  redirect(ACCOUNT_LINKS, RedirectType.replace);
}
