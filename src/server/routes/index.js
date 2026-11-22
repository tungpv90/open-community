import { errorResponse, json } from '../http/responses.js';
import { clearCache } from '../services/cache.js';
import { createSupabaseClient, isSupabaseConfigured } from '../services/supabase.js';
import { handleAdminRoute } from './admin.js';
import { handleAuthRoute } from './auth.js';
import { handleCategoryRoute } from './categories.js';
import { handleDiscussionRoute } from './discussions.js';
import { handleNotificationRoute } from './notifications.js';
import { handleSystemRoute } from './system.js';

/** Writes that public pages can observe; view counts may lag until the cache refreshes. */
function changesPublicData(request, url) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
  return !/^\/api\/(?:discussions\/[^/]+\/view|auth\/(?:login|refresh|logout|recover))$/.test(
    url.pathname,
  );
}

async function handleApiRequest(request, environment, url) {
  const systemResponse = await handleSystemRoute(request, environment, url);
  if (systemResponse) {
    return systemResponse;
  }

  if (!isSupabaseConfigured(environment)) {
    return json({ error: 'Supabase is not configured' }, 503);
  }

  const supabase = createSupabaseClient(environment);

  try {
    const response =
      (await handleAuthRoute(request, url, supabase, environment)) ||
      (await handleAdminRoute(request, url, supabase)) ||
      (await handleNotificationRoute(request, url, supabase)) ||
      (await handleCategoryRoute(request, url, supabase)) ||
      (await handleDiscussionRoute(request, url, supabase));

    return response || json({ error: 'API route not found' }, 404);
  } catch (error) {
    return errorResponse(error);
  } finally {
    // Reads still in flight are discarded too (see cache.js), so none can predate the write.
    if (changesPublicData(request, url)) clearCache();
  }
}

export { handleApiRequest };
