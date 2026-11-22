'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import { displayName, useCommunity } from '@/components/session/community-provider';
import { api, errorMessage } from '@/utils/api/client';

const initialPassword = 'admin@12345';

/** Blocks the administration console until the initial administrator password is replaced. */
export function PasswordChangeRequired() {
  const { user, refreshUser, signOut } = useCommunity();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password === initialPassword) return setError('Choose a password other than the default.');
    if (password !== confirmation) return setError('The two passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ password }) });
      await refreshUser();
    } catch (submitError) {
      setError(errorMessage(submitError, 'Could not update your password'));
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card compact-card">
        <div className="auth-heading">
          <span className="auth-mark">!</span>
          <div>
            <p>Administration</p>
            <h1>Change the default password</h1>
            <span>
              {displayName(user)} is still using the initial password. Choose a new one to open the
              administration console.
            </span>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
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
              minLength={8}
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
          <button className="button button-primary button-block" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
        <p className="auth-switch">
          <button className="link-button" type="button" onClick={() => void signOut()}>
            Log out
          </button>
        </p>
      </section>
    </main>
  );
}
