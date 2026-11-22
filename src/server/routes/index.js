import { errorResponse, json } from '../http/responses.js';
import { createSupabaseClient, isSupabaseConfigured } from '../services/supabase.js';
import { handleAdminRoute } from './admin.js';
import { handleAuthRoute } from './auth.js';
import { handleCategoryRoute } from './categories.js';
import { handleDiscussionRoute } from './discussions.js';
import { handleNotificationRoute } from './notifications.js';
import { handleSystemRoute } from './system.js';

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
  }
}

export { handleApiRequest };
