/** Server-side configuration passed to the API handlers in `src/server/`. Never import in browser code. */
export function getServerEnvironment() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL || '',
    AUTH_OAUTH_PROVIDERS: process.env.AUTH_OAUTH_PROVIDERS || '',
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || '',
  };
}
