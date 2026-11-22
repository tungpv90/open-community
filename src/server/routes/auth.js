import { json } from '../http/responses.js';
import {
  getOAuthProviders,
  getPublicSiteUrl,
  getSupabaseOAuthProvider,
  getTurnstileSiteKey,
} from '../config/authentication.js';

function normalizeCredentials(input) {
  const email = String(input.email || '')
    .trim()
    .toLowerCase();
  const password = String(input.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6 || password.length > 128) return null;
  return { email, password };
}

function getSignupEmailError(email) {
  const [localPart, domain, ...extraParts] = email.split('@');
  if (!extraParts.length && domain === 'gmail.com' && localPart.length < 6) {
    return 'Supabase does not accept Gmail addresses with fewer than 6 characters before @gmail.com. Use another valid email address.';
  }
  return '';
}

async function handleAuthRoute(request, url, supabase, environment) {
  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const input = await request.json().catch(() => ({}));
    const credentials = normalizeCredentials(input);
    if (!credentials) return json({ error: 'Email or password is invalid' }, 422);
    const { body } = await supabase.request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    return json(body);
  }

  if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
    const input = await request.json().catch(() => ({}));
    // Honeypot: the hidden `website` field is never filled by people. Answer like a successful
    // signup without a session so bots get no signal, and create nothing.
    if (String(input.website || '').trim()) return json({ user: null, session: null });
    const credentials = normalizeCredentials(input);
    if (!credentials) return json({ error: 'Email or password is invalid' }, 422);
    const captchaToken = String(input.captchaToken || '');
    if (getTurnstileSiteKey(environment) && !captchaToken) {
      return json({ error: 'Complete the verification challenge before signing up' }, 422);
    }
    const emailError = getSignupEmailError(credentials.email);
    if (emailError) return json({ error: emailError }, 422);
    const { body: settingsRows } = await supabase.request(
      '/rest/v1/forum_settings?key=eq.general&select=value',
      { method: 'GET' },
    );
    if ((settingsRows[0]?.value?.registration || 'open') !== 'open') {
      return json({ error: 'New account registration is currently closed' }, 403);
    }
    const { body } = await supabase.request('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        data: {
          display_name: String(input.name || credentials.email.split('@')[0])
            .trim()
            .slice(0, 80),
        },
        // Supabase verifies this token with the captcha secret configured in
        // Authentication > Attack Protection, so the secret never reaches this server.
        ...(captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {}),
      }),
    });

    return json(body);
  }

  if (url.pathname === '/api/auth/refresh' && request.method === 'POST') {
    const input = await request.json().catch(() => ({}));
    if (!input.refresh_token) return json({ error: 'Refresh token is required' }, 422);
    const { body } = await supabase.request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: input.refresh_token }),
    });
    return json(body);
  }

  if (url.pathname === '/api/auth/recover' && request.method === 'POST') {
    const input = await request.json().catch(() => ({}));
    const email = String(input.email || '')
      .trim()
      .toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Email address is invalid' }, 422);
    const redirectTo = `${getPublicSiteUrl(request, environment)}/reset-password`;
    // Supabase answers the same way for known and unknown addresses, so this does not reveal
    // whether an account exists.
    await supabase.request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return json({ ok: true });
  }

  if (url.pathname === '/api/auth/password' && request.method === 'POST') {
    const { token } = await supabase.getUser(request);
    const input = await request.json().catch(() => ({}));
    const password = String(input.password || '');
    if (password.length < 6 || password.length > 128) {
      return json({ error: 'Password must be between 6 and 128 characters' }, 422);
    }
    await supabase.request(
      '/auth/v1/user',
      { method: 'PUT', body: JSON.stringify({ password }) },
      token,
    );
    return json({ ok: true });
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const { token } = await supabase.getUser(request);
    await supabase.request('/auth/v1/logout', { method: 'POST' }, token);
    return json({ ok: true });
  }

  const oauthMatch = url.pathname.match(/^\/api\/auth\/oauth\/([^/]+)$/);
  if (oauthMatch && request.method === 'GET') {
    const provider = oauthMatch[1].toLowerCase();
    if (!getOAuthProviders(environment).includes(provider)) {
      return json({ error: 'This sign-in provider is not configured' }, 404);
    }
    const supabaseProvider = getSupabaseOAuthProvider(provider);
    if (!supabaseProvider) return json({ error: 'This sign-in provider is invalid' }, 422);
    const authorizeUrl = new URL('/auth/v1/authorize', environment.SUPABASE_URL);
    authorizeUrl.searchParams.set('provider', supabaseProvider);
    authorizeUrl.searchParams.set(
      'redirect_to',
      `${getPublicSiteUrl(request, environment)}/?auth_callback=1`,
    );
    return json({ url: authorizeUrl.toString() });
  }

  if (url.pathname === '/api/me' && request.method === 'GET') {
    const { user, token } = await supabase.getUser(request);
    const userId = encodeURIComponent(user.id);
    const profileRequest = supabase
      .request(`/rest/v1/forum_profiles?id=eq.${userId}&select=*`, { method: 'GET' }, token)
      .catch((error) => {
        if (
          /forum_profiles.*schema cache|relation.*forum_profiles.*does not exist/i.test(
            error.message || '',
          )
        ) {
          return { body: [] };
        }
        throw error;
      });
    const [profile, role] = await Promise.all([
      profileRequest,
      supabase.request(
        `/rest/v1/user_roles?user_id=eq.${userId}&select=role`,
        { method: 'GET' },
        token,
      ),
    ]);
    const forumRole =
      role.body[0]?.role === 'admin' ? 'admin' : profile.body[0]?.forum_role || 'member';

    return json({
      user: {
        ...user,
        profile: profile.body[0] || null,
        role: forumRole,
        forum_schema_ready: Boolean(profile.body[0]),
      },
    });
  }

  return null;
}

export { handleAuthRoute };
