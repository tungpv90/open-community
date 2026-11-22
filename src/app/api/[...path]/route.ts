import { handleApiRequest } from '@/server/routes/index.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getEnvironment() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL || '',
    AUTH_OAUTH_PROVIDERS: process.env.AUTH_OAUTH_PROVIDERS || '',
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || '',
  };
}

async function handle(request: Request) {
  return handleApiRequest(request, getEnvironment(), new URL(request.url));
}

export { handle as DELETE, handle as GET, handle as PATCH, handle as POST, handle as PUT };
