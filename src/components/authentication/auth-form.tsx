'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { TurnstileWidget } from '@/components/authentication/turnstile-widget';
import { communityTitle, useCommunity } from '@/components/session/community-provider';
import { api, errorMessage, storeAuthSession } from '@/utils/api/client';

type AuthMode = 'login' | 'signup';

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  session?: { access_token: string; refresh_token?: string } | null;
};

const providerLabels: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  github: 'GitHub',
};

/** Returns a same-site path from `?next=`, never an absolute or protocol-relative URL. */
export function safeNextPath(search: string) {
  const next = new URLSearchParams(search).get('next') || '';
  return /^\/(?!\/)/.test(next) ? next : '/';
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { ready, user, authProviders, turnstileSiteKey, settings, refreshUser } = useCommunity();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState('/');
  const [apaxLogin, setApaxLogin] = useState(false);
  const [website, setWebsite] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const emailInput = useRef<HTMLInputElement>(null);

  const registrationClosed = mode === 'signup' && settings.registration === 'closed';
  const loginHref = nextPath === '/' ? '/login' : `/login?next=${encodeURIComponent(nextPath)}`;
  const needsCaptcha = mode === 'signup' && Boolean(turnstileSiteKey);
  const signupHref = nextPath === '/' ? '/signup' : `/signup?next=${encodeURIComponent(nextPath)}`;

  useEffect(() => {
    setNextPath(safeNextPath(window.location.search));
    if (new URLSearchParams(window.location.search).has('registered')) {
      setNotice('Account created. Check your inbox to confirm your email, then log in.');
    }
  }, []);

  useEffect(() => {
    if (ready && user) router.replace(nextPath);
  }, [nextPath, ready, router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registrationClosed) return;
    if (needsCaptcha && !captchaToken) {
      setError('Complete the verification challenge before signing up.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api<AuthResponse>(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(
          mode === 'signup'
            ? { name, email, password, website, captchaToken }
            : { email, password },
        ),
      });
      const session = result.session || result;
      if (session.access_token) {
        storeAuthSession(
          { access_token: session.access_token, refresh_token: session.refresh_token },
          remember,
        );
        await refreshUser();
        router.replace(nextPath);
      } else {
        router.replace(`${loginHref}${loginHref.includes('?') ? '&' : '?'}registered=1`);
        setNotice('Account created. Check your inbox to confirm your email, then log in.');
        setPassword('');
      }
    } catch (submitError) {
      setError(errorMessage(submitError, 'Authentication failed'));
    } finally {
      setBusy(false);
      // Captcha tokens are single use.
      if (needsCaptcha) setCaptchaReset((count) => count + 1);
    }
  }

  async function oauth(provider: string) {
    setError('');
    try {
      const result = await api<{ url: string }>(`/api/auth/oauth/${encodeURIComponent(provider)}`);
      window.location.assign(result.url);
    } catch (oauthError) {
      setError(errorMessage(oauthError, 'Could not open this provider'));
    }
  }

  /** APAX ID accounts live in the same Supabase project, so they sign in with email and password. */
  function chooseApaxId() {
    setError('');
    setApaxLogin(true);
    emailInput.current?.focus();
  }

  const showProviders = mode === 'login';

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-heading">
          <span className="auth-mark">{String(settings.headerBrand?.mark || 'F').slice(0, 3)}</span>
          <div>
            <p>{mode === 'login' ? 'Welcome back' : 'Join the community'}</p>
            <h1>
              {mode === 'login' ? `Log in to ${communityTitle(settings)}` : 'Create your account'}
            </h1>
            <span>
              {mode === 'login'
                ? 'Continue the conversations that matter to you.'
                : 'Ask questions, share ideas, and meet thoughtful people.'}
            </span>
          </div>
        </div>

        {notice ? (
          <p className="form-success" role="status">
            {notice}
          </p>
        ) : null}

        {registrationClosed ? (
          <p className="form-error" role="alert">
            Registration is currently closed. Contact a community administrator for an invitation.
          </p>
        ) : null}

        {showProviders ? (
          <>
            <div className="oauth-grid">
              <button
                type="button"
                className="apax-id-button"
                onClick={chooseApaxId}
                aria-pressed={apaxLogin}
              >
                <b>A</b> Continue with APAX ID
              </button>
              {authProviders.map((provider) => (
                <button type="button" onClick={() => oauth(provider)} key={provider}>
                  <b>{provider[0].toUpperCase()}</b> Continue with{' '}
                  {providerLabels[provider] || provider[0].toUpperCase() + provider.slice(1)}
                </button>
              ))}
            </div>
            <div className="auth-divider">
              <span>or use email</span>
            </div>
          </>
        ) : null}

        {apaxLogin ? (
          <p className="auth-hint" role="status">
            Sign in with the email address and password of your APAX ID account.
          </p>
        ) : null}

        <form onSubmit={submit}>
          {mode === 'signup' ? (
            <label>
              <span>Display name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
                maxLength={80}
                placeholder="How should we call you?"
                disabled={registrationClosed}
              />
            </label>
          ) : null}
          {mode === 'signup' ? (
            // Honeypot: hidden from people and assistive technology, filled in by naive bots.
            <label className="auth-honeypot" aria-hidden="true">
              <span>Website</span>
              <input
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          ) : null}
          <label>
            <span>Email address</span>
            <input
              ref={emailInput}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              disabled={registrationClosed}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              maxLength={128}
              placeholder="At least 6 characters"
              disabled={registrationClosed}
            />
          </label>
          <div className="auth-options">
            <label className="check-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Keep me signed in
            </label>
            {mode === 'login' ? <Link href="/forgot-password">Forgot password?</Link> : null}
          </div>
          {needsCaptcha && !registrationClosed ? (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              resetKey={captchaReset}
              onToken={setCaptchaToken}
            />
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="button button-primary button-block"
            type="submit"
            disabled={busy || registrationClosed || (needsCaptcha && !captchaToken)}
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? 'New to the community?' : 'Already have an account?'}{' '}
          <Link href={mode === 'login' ? signupHref : loginHref}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </Link>
        </p>
      </section>
    </main>
  );
}
