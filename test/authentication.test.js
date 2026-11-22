import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAuthRoute } from '../src/server/routes/auth.js';

test('OAuth endpoint returns a same-site Supabase authorization URL', async () => {
  const message = new Request('https://community.example/api/auth/oauth/google');
  const response = await handleAuthRoute(
    message,
    new URL(message.url),
    {},
    {
      SUPABASE_URL: 'https://project.supabase.co',
      AUTH_OAUTH_PROVIDERS: 'google,facebook',
      PUBLIC_SITE_URL: 'https://community.example',
    },
  );
  const data = await response.json();
  const authorizeUrl = new URL(data.url);

  assert.equal(response.status, 200);
  assert.equal(authorizeUrl.origin, 'https://project.supabase.co');
  assert.equal(authorizeUrl.searchParams.get('provider'), 'google');
  assert.equal(
    authorizeUrl.searchParams.get('redirect_to'),
    'https://community.example/?auth_callback=1',
  );
});

test('LinkedIn uses the OIDC provider shared with APAX ID', async () => {
  const message = new Request('https://community.example/api/auth/oauth/linkedin');
  const response = await handleAuthRoute(
    message,
    new URL(message.url),
    {},
    {
      SUPABASE_URL: 'https://project.supabase.co',
      AUTH_OAUTH_PROVIDERS: 'google,linkedin',
    },
  );

  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(new URL(data.url).searchParams.get('provider'), 'linkedin_oidc');
});

test('refresh endpoint exchanges a refresh token through Supabase', async () => {
  const calls = [];
  const supabase = {
    request: async (...args) => {
      calls.push(args);
      return { body: { access_token: 'new-token', refresh_token: 'new-refresh' } };
    },
  };
  const message = new Request('https://community.example/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: 'old-refresh' }),
  });
  const response = await handleAuthRoute(message, new URL(message.url), supabase, {});

  assert.equal(response.status, 200);
  assert.equal(calls[0][0], '/auth/v1/token?grant_type=refresh_token');
  assert.deepEqual(JSON.parse(calls[0][1].body), { refresh_token: 'old-refresh' });
});

test('Community signup explains the Supabase short Gmail restriction', async () => {
  const supabase = {
    request: async () => {
      assert.fail('Supabase should not be called for a rejected signup address');
    },
  };
  const message = new Request('https://community.example/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: 'heta@gmail.com',
      password: 'a-secure-password',
      name: 'Heta',
    }),
  });
  const response = await handleAuthRoute(message, new URL(message.url), supabase, {});
  const data = await response.json();

  assert.equal(response.status, 422);
  assert.match(data.error, /fewer than 6 characters/);
});

test('Community signup labels the new Supabase user source', async () => {
  const calls = [];
  const supabase = {
    request: async (...args) => {
      calls.push(args);
      if (args[0].startsWith('/rest/v1/forum_settings')) {
        return { body: [{ value: { registration: 'open' } }] };
      }
      return { body: { user: { id: 'community-user' } } };
    },
  };
  const message = new Request('https://community.example/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: 'member@gmail.com',
      password: 'a-secure-password',
      name: 'Community Member',
    }),
  });
  const response = await handleAuthRoute(message, new URL(message.url), supabase, {});
  const signupCall = calls.find(([path]) => path === '/auth/v1/signup');
  const signupBody = JSON.parse(signupCall[1].body);

  assert.equal(response.status, 200);
  assert.equal(signupBody.data.account_source, 'community');
  assert.equal(signupBody.data.display_name, 'Community Member');
});

test('password recovery sends a reset link back to this site', async () => {
  const calls = [];
  const supabase = {
    request: async (...args) => {
      calls.push(args);
      return { body: {} };
    },
  };
  const message = new Request('https://community.example/api/auth/recover', {
    method: 'POST',
    body: JSON.stringify({ email: ' Member@Example.com ' }),
  });
  const response = await handleAuthRoute(message, new URL(message.url), supabase, {
    PUBLIC_SITE_URL: 'https://community.example',
  });

  assert.equal(response.status, 200);
  const recoverUrl = new URL(calls[0][0], 'https://project.supabase.co');
  assert.equal(recoverUrl.pathname, '/auth/v1/recover');
  assert.equal(
    recoverUrl.searchParams.get('redirect_to'),
    'https://community.example/reset-password',
  );
  assert.deepEqual(JSON.parse(calls[0][1].body), { email: 'member@example.com' });
});

test('password recovery rejects malformed email addresses without calling Supabase', async () => {
  const supabase = { request: async () => assert.fail('Supabase should not be called') };
  const message = new Request('https://community.example/api/auth/recover', {
    method: 'POST',
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  const response = await handleAuthRoute(message, new URL(message.url), supabase, {});

  assert.equal(response.status, 422);
});

test('password update requires a valid length and uses the caller token', async () => {
  const calls = [];
  const supabase = {
    getUser: async () => ({ token: 'Bearer member-token', user: { id: 'member' } }),
    request: async (...args) => {
      calls.push(args);
      return { body: {} };
    },
  };
  const tooShort = new Request('https://community.example/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ password: '123' }),
  });
  assert.equal((await handleAuthRoute(tooShort, new URL(tooShort.url), supabase, {})).status, 422);

  const message = new Request('https://community.example/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ password: 'a-new-password' }),
  });
  const response = await handleAuthRoute(message, new URL(message.url), supabase, {});

  assert.equal(response.status, 200);
  assert.equal(calls[0][0], '/auth/v1/user');
  assert.equal(calls[0][1].method, 'PUT');
  assert.equal(calls[0][2], 'Bearer member-token');
});

function signupSupabase(calls) {
  return {
    request: async (...args) => {
      calls.push(args);
      if (args[0].startsWith('/rest/v1/forum_settings')) {
        return { body: [{ value: { registration: 'open' } }] };
      }
      return { body: { user: { id: 'community-user' } } };
    },
  };
}

function signupRequest(fields) {
  return new Request('https://community.example/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: 'member@gmail.com',
      password: 'a-secure-password',
      name: 'Community Member',
      ...fields,
    }),
  });
}

test('Signup honeypot answers like success without creating an account', async () => {
  const calls = [];
  const message = signupRequest({ website: 'https://spam.example' });
  const response = await handleAuthRoute(message, new URL(message.url), signupSupabase(calls), {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: null, session: null });
  assert.equal(calls.length, 0);
});

test('Signup requires a captcha token when Turnstile is configured', async () => {
  const calls = [];
  const message = signupRequest({});
  const response = await handleAuthRoute(message, new URL(message.url), signupSupabase(calls), {
    TURNSTILE_SITE_KEY: '0x4AAAAAAAtest',
  });

  assert.equal(response.status, 422);
  assert.equal(calls.length, 0);
});

test('Signup forwards the captcha token for Supabase to verify', async () => {
  const calls = [];
  const message = signupRequest({ captchaToken: 'turnstile-token' });
  const response = await handleAuthRoute(message, new URL(message.url), signupSupabase(calls), {
    TURNSTILE_SITE_KEY: '0x4AAAAAAAtest',
  });
  const signupCall = calls.find(([path]) => path === '/auth/v1/signup');

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(signupCall[1].body).gotrue_meta_security, {
    captcha_token: 'turnstile-token',
  });
});
