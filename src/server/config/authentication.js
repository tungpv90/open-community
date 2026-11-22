const supportedOAuthProviders = new Set(['google', 'facebook', 'linkedin']);

function getOAuthProviders(environment) {
  const configured = String(environment.AUTH_OAUTH_PROVIDERS || 'google,facebook,linkedin')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => supportedOAuthProviders.has(provider));

  return [...new Set(configured)];
}

function getSupabaseOAuthProvider(provider) {
  const value = provider === 'linkedin' ? 'linkedin_oidc' : provider;
  return /^[a-z0-9_-]+$/i.test(value) ? value : '';
}

function getPublicSiteUrl(request, environment) {
  const candidate = environment.PUBLIC_SITE_URL || new URL(request.url).origin;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PUBLIC_SITE_URL must use HTTP or HTTPS');
  }
  return url.origin;
}

/** Public Cloudflare Turnstile site key; empty disables the signup challenge. */
function getTurnstileSiteKey(environment) {
  const value = String(environment.TURNSTILE_SITE_KEY || '').trim();
  return /^[\w-]{1,100}$/.test(value) ? value : '';
}

export { getOAuthProviders, getPublicSiteUrl, getSupabaseOAuthProvider, getTurnstileSiteKey };
