import { handleApiRequest } from '@/server/routes/index.js';
import { getServerEnvironment } from '@/utils/server-environment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(request: Request) {
  return handleApiRequest(request, getServerEnvironment(), new URL(request.url));
}

export { handle as DELETE, handle as GET, handle as PATCH, handle as POST, handle as PUT };
