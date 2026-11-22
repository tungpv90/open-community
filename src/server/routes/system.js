import { json } from '../http/responses.js';
import { getOAuthProviders, getTurnstileSiteKey } from '../config/authentication.js';
import { createSupabaseClient, isSupabaseConfigured } from '../services/supabase.js';

async function handleSystemRoute(request, environment, url) {
  if (request.method !== 'GET') {
    return null;
  }

  if (url.pathname === '/api/health') {
    return json({
      status: 'ok',
      service: 'flarum-community',
      supabase: isSupabaseConfigured(environment) ? 'configured' : 'demo',
    });
  }

  if (url.pathname === '/api/config') {
    if (!isSupabaseConfigured(environment))
      return json({ configured: false, settings: {}, auth_providers: [] });
    const supabase = createSupabaseClient(environment);
    const settings = await supabase
      .request('/rest/v1/forum_settings?key=eq.general&select=value', { method: 'GET' })
      .then(({ body }) => body[0]?.value || {})
      .catch(() => ({}));
    return json({
      configured: true,
      settings,
      auth_providers: getOAuthProviders(environment),
      turnstile_site_key: getTurnstileSiteKey(environment),
    });
  }

  return null;
}

export { handleSystemRoute };
