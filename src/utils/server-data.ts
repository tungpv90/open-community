import { cache } from 'react';

import { listCategories } from '@/server/routes/categories.js';
import { loadDiscussionList, loadDiscussionThread } from '@/server/routes/discussions.js';
import { createSupabaseClient, isSupabaseConfigured } from '@/server/services/supabase.js';
import { getServerEnvironment } from '@/utils/server-environment';

/**
 * Data that server components render into the first HTML response, so visitors see content
 * without waiting for client-side requests. Everything here is the anonymous view; the browser
 * adds viewer-specific state (follows, likes) once it knows who is signed in.
 * Never import in browser code.
 */

export type HomeData = { discussions: Record<string, any>[]; categories: unknown[] };
export type ThreadData = { discussion: Record<string, any>; posts: Record<string, any>[] };

function supabaseClient() {
  const environment = getServerEnvironment();
  return isSupabaseConfigured(environment) ? createSupabaseClient(environment) : null;
}

/** The home feed, or null when it cannot be loaded (the browser then loads it itself). */
export async function loadHomeData(): Promise<HomeData | null> {
  const supabase = supabaseClient();
  if (!supabase) return null;
  try {
    const [discussions, categories] = await Promise.all([
      loadDiscussionList(supabase),
      listCategories(supabase),
    ]);
    return { discussions, categories };
  } catch {
    return null;
  }
}

/**
 * One discussion with its posts. Returns null when it does not exist and undefined when it
 * could not be loaded. Shared by `generateMetadata` and the page within one request.
 */
export const loadThreadData = cache(async (id: string): Promise<ThreadData | null | undefined> => {
  const supabase = supabaseClient();
  if (!supabase) return undefined;
  try {
    return (await loadDiscussionThread(supabase, id)) as ThreadData | null;
  } catch {
    return undefined;
  }
});
