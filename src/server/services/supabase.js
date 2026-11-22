function isSupabaseConfigured(environment) {
  return Boolean(environment.SUPABASE_URL && environment.SUPABASE_ANON_KEY);
}

function createSupabaseClient(environment) {
  async function request(path, init = {}, token = '') {
    const headers = new Headers(init.headers || {});
    headers.set('apikey', environment.SUPABASE_ANON_KEY);
    headers.set('content-type', 'application/json');
    headers.set('authorization', token || `Bearer ${environment.SUPABASE_ANON_KEY}`);

    const baseUrl = environment.SUPABASE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.msg ||
          body.message ||
          body.error_description ||
          body.error ||
          'Supabase request failed',
      );
    }

    return { body, headers: response.headers };
  }

  async function getUser(requestMessage) {
    const token = requestMessage.headers.get('authorization') || '';
    if (!token.startsWith('Bearer ')) {
      throw new Error('Authentication required');
    }

    const { body: user } = await request('/auth/v1/user', { method: 'GET' }, token);
    return { token, user };
  }

  async function getAdmin(requestMessage) {
    const auth = await getUser(requestMessage);
    const userId = encodeURIComponent(auth.user.id);
    const { body: roles } = await request(
      `/rest/v1/user_roles?user_id=eq.${userId}&select=role`,
      { method: 'GET' },
      auth.token,
    );

    if (!roles[0] || roles[0].role !== 'admin') {
      throw new Error('Administrator access required');
    }

    return auth;
  }

  // Identifies the project so shared caches never mix data from different databases.
  const cacheKey = environment.SUPABASE_URL.replace(/\/$/, '');

  return { cacheKey, getAdmin, getUser, request };
}

export { createSupabaseClient, isSupabaseConfigured };
