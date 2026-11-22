'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { useCommunity } from '@/components/session/community-provider';
import { api, errorMessage } from '@/utils/api/client';

function RecoveryCard({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card compact-card">
        <div className="auth-heading">
          <span className="auth-mark">F</span>
          <div>
            <p>{eyebrow}</p>
            <h1>{title}</h1>
            <span>{copy}</span>
          </div>
        </div>
        {children}
        <p className="auth-switch">
          <Link href="/login">Return to login</Link>
        </p>
      </section>
    </main>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/recover', { method: 'POST', body: JSON.stringify({ email }) });
      setSent(true);
    } catch (submitError) {
      setError(errorMessage(submitError, 'Could not send the recovery email'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RecoveryCard
      eyebrow="Account recovery"
      title="Reset your password"
      copy="Enter the email you signed up with and we will send you a reset link."
    >
      {sent ? (
        <p className="form-success" role="status">
          If an account exists for {email}, a password reset link is on its way. The link opens this
          site so you can choose a new password.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label>
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button button-primary button-block" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </RecoveryCard>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const { ready, user } = useCommunity();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) return setError('The two passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ password }) });
      router.replace('/');
    } catch (submitError) {
      setError(errorMessage(submitError, 'Could not update your password'));
      setBusy(false);
    }
  }

  if (ready && !user) {
    return (
      <RecoveryCard
        eyebrow="Account recovery"
        title="This link has expired"
        copy="Password reset links can only be used once and expire after a short time."
      >
        <Link className="button button-primary button-block" href="/forgot-password">
          Request a new link
        </Link>
      </RecoveryCard>
    );
  }

  return (
    <RecoveryCard
      eyebrow="Account recovery"
      title="Choose a new password"
      copy="Use at least 6 characters. You will stay signed in on this device."
    >
      <form onSubmit={submit}>
        <label>
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          <span>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={128}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="button button-primary button-block"
          type="submit"
          disabled={busy || !ready}
        >
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </RecoveryCard>
  );
}
