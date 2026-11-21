"use server";

import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import {
  addPlaces,
  createList,
  deleteList,
  ListInputSchema,
  ListNotFoundError,
  removePlaces,
  restorePlaces,
  type RemovedItem,
  updateList,
  VISIBILITIES,
} from "./lists";

export type ListFormState = { error?: string; created?: boolean };
type Result = { error?: string };

const FAILED = "저장하지 못했어요. 다시 시도해 주세요.";
const NOT_MINE = "내 리스트가 아니에요.";
const Ids = z.array(z.uuid()).max(2000);

export async function createListWithPlaces(_prev: ListFormState, formData: FormData): Promise<ListFormState> {
  const parsed = ListInputSchema.safeParse({ name: formData.get("name") ?? "", description: formData.get("description") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const placeIds = Ids.safeParse(formData.getAll("placeId"));
  if (!placeIds.success) return { error: FAILED };

  const { supabase, userId } = await requireUser();
  let listId: string;
  try {
    listId = await createList(supabase, userId, parsed.data);
    await addPlaces(supabase, userId, listId, placeIds.data);
  } catch {
    return { error: FAILED };
  }
  revalidatePath("/", "layout");
  if (formData.get("stay")) return { created: true };
  redirect(`/lists/${listId}`, RedirectType.replace);
}

export async function saveListInfo(listId: string, name: string, description: string): Promise<Result> {
  const parsed = ListInputSchema.safeParse({ name, description });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  return run(listId, (s, u) => updateList(s, u, listId, parsed.data));
}

export async function setListVisibility(listId: string, visibility: string): Promise<Result> {
  const v = z.enum(VISIBILITIES).safeParse(visibility);
  if (!v.success) return { error: FAILED };
  return run(listId, (s, u) => updateList(s, u, listId, { visibility: v.data }));
}

export async function addPlacesToList(listId: string, placeIds: string[]): Promise<Result> {
  const ids = Ids.safeParse(placeIds);
  if (!ids.success) return { error: FAILED };
  return run(listId, (s, u) => addPlaces(s, u, listId, ids.data));
}

export async function removePlacesFromList(listId: string, placeIds: string[]): Promise<Result & { removed?: RemovedItem[] }> {
  const ids = Ids.safeParse(placeIds);
  if (!ids.success) return { error: FAILED };
  let removed: RemovedItem[] = [];
  const res = await run(listId, async (s, u) => {
    removed = await removePlaces(s, u, listId, ids.data);
  });
  return res.error ? res : { removed };
}

const Removed = z.array(z.object({ placeId: z.uuid(), addedAt: z.iso.datetime({ offset: true }) })).max(2000);

export async function restorePlacesToList(listId: string, items: RemovedItem[]): Promise<Result> {
  const parsed = Removed.safeParse(items);
  if (!parsed.success) return { error: FAILED };
  return run(listId, (s, u) => restorePlaces(s, u, listId, parsed.data));
}

export async function removeList(listId: string): Promise<Result> {
  const result = await run(listId, (s, u) => deleteList(s, u, listId));
  if (!result.error) revalidatePath("/lists");
  return result;
}

async function run(
  listId: string,
  write: (supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) => Promise<void>,
): Promise<Result> {
  if (!z.uuid().safeParse(listId).success) return { error: NOT_MINE };
  const { supabase, userId } = await requireUser();
  try {
    await write(supabase, userId);
  } catch (error) {
    return { error: error instanceof ListNotFoundError ? NOT_MINE : FAILED };
  }
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  return {};
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  return { supabase, userId };
}
