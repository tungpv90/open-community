'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useCommunity } from '@/components/session/community-provider';
import type { CommunitySettings } from '@/lib/community-settings';
import { api, errorMessage } from '@/utils/api/client';

export type AdminUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  username?: string;
  display_name?: string;
  status?: string;
  role?: string;
  joined_at?: string;
  last_seen_at?: string | null;
};

export type AdminTag = {
  id: string;
  name: string;
  slug: string;
  color: string;
  description?: string;
};

export type AdminCategory = AdminTag & { position?: number; discussion_count?: number };

export type AdminGroup = { id: string; name: string; color: string };

export type AdminReport = {
  id: string;
  reason?: string;
  status?: string;
  created_at?: string;
  post_id?: string | null;
  discussion_id?: string | null;
};

export type AdminOverview = {
  users: AdminUser[];
  discussion_count: number;
  post_count: number;
  tags: AdminTag[];
  categories: AdminCategory[];
  groups: AdminGroup[];
  reports: AdminReport[];
  settings: { key: string; value: CommunitySettings }[];
};

type AdminDataValue = {
  data: AdminOverview | null;
  loading: boolean;
  error: string;
  settings: CommunitySettings;
  reload: () => Promise<void>;
  /** Merges `patch` into the stored community settings and saves the complete object. */
  saveSettings: (patch: CommunitySettings) => Promise<void>;
};

const AdminDataContext = createContext<AdminDataValue | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { setSettings } = useCommunity();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const overview = await api<AdminOverview>('/api/admin/overview');
      setData(overview);
      setError('');
    } catch (loadError) {
      setError(errorMessage(loadError, 'Could not load administration data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const settings = useMemo(
    () => data?.settings.find((row) => row.key === 'general')?.value || {},
    [data],
  );

  const saveSettings = useCallback(
    async (patch: CommunitySettings) => {
      const next = { ...settings, ...patch };
      await api('/api/admin/settings', { method: 'POST', body: JSON.stringify(next) });
      setData((current) =>
        current
          ? {
              ...current,
              settings: [
                ...current.settings.filter((row) => row.key !== 'general'),
                { key: 'general', value: next },
              ],
            }
          : current,
      );
      setSettings(next);
    },
    [setSettings, settings],
  );

  const value = useMemo(
    () => ({ data, loading, error, settings, reload, saveSettings }),
    [data, error, loading, reload, saveSettings, settings],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error('useAdminData must be used inside AdminDataProvider');
  return context;
}

/** Tracks a single in-flight admin action and its success or error message. */
export function useAdminAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text: success, error: false });
      return true;
    } catch (actionError) {
      setMessage({ text: errorMessage(actionError, 'Something went wrong'), error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, message, setMessage, run };
}

export function ActionMessage({ message }: { message: { text: string; error: boolean } | null }) {
  if (!message) return null;
  return (
    <p
      className={message.error ? 'form-error' : 'form-success'}
      role={message.error ? 'alert' : 'status'}
    >
      {message.text}
    </p>
  );
}

export function PageHeading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <header className="admin-page-heading">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </header>
  );
}

/** Renders admin page content once the overview is loaded. */
export function AdminPage({ children }: { children: (data: AdminOverview) => ReactNode }) {
  const { data, loading, error, reload } = useAdminData();
  if (loading) {
    return (
      <main className="admin-content">
        <div className="admin-loading">Loading administration…</div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="admin-content">
        <div className="admin-error">
          <h1>Could not load administration data</h1>
          <p>{error}</p>
          <button className="button button-primary" type="button" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      </main>
    );
  }
  return <main className="admin-content">{children(data)}</main>;
}
