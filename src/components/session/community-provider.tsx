'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { defaultCommunityTitle, isHexColor } from '@/lib/community-settings';
import type { CommunitySettings } from '@/lib/community-settings';
import {
  api,
  ApiError,
  authChangeEvent,
  clearAuthSession,
  getAccessToken,
  storeAuthSession,
} from '@/utils/api/client';

export type CommunityRole = 'admin' | 'moderator' | 'member';

export type CommunityUser = {
  id: string;
  email?: string;
  role: CommunityRole;
  /** True while an administrator still uses the initial password. */
  password_change_required?: boolean;
  profile: {
    display_name?: string;
    username?: string;
    avatar_color?: string;
    status?: string;
  } | null;
};

type CommunityConfig = {
  configured: boolean;
  settings: CommunitySettings;
  auth_providers: string[];
  turnstile_site_key?: string;
};

type CommunityContextValue = {
  /** True once configuration and the signed-in user (if any) have been resolved. */
  ready: boolean;
  configured: boolean;
  settings: CommunitySettings;
  authProviders: string[];
  /** Public Cloudflare Turnstile key for the signup challenge; empty when disabled. */
  turnstileSiteKey: string;
  user: CommunityUser | null;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  setSettings: (settings: CommunitySettings) => void;
};

const CommunityContext = createContext<CommunityContextValue | null>(null);
const themeStorageKey = 'community_theme';

export function displayName(user: CommunityUser | null) {
  if (!user) return '';
  return (
    user.profile?.display_name || user.profile?.username || user.email?.split('@')[0] || 'Member'
  );
}

/** Stores a session delivered in the URL hash by Supabase OAuth, email confirmation, or recovery. */
function consumeAuthCallback() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const url = new URL(window.location.href);
  const hadCallbackParam = url.searchParams.has('auth_callback');

  if (!accessToken && !hadCallbackParam && !hash.has('error_description')) {
    return;
  }

  if (accessToken) {
    storeAuthSession({ access_token: accessToken, refresh_token: hash.get('refresh_token') || '' });
  }

  url.searchParams.delete('auth_callback');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

function applySettings(settings: CommunitySettings) {
  const root = document.documentElement;
  if (isHexColor(settings.primary)) root.style.setProperty('--brand', String(settings.primary));
  else root.style.removeProperty('--brand');
  if (isHexColor(settings.secondary)) {
    root.style.setProperty('--secondary', String(settings.secondary));
  } else root.style.removeProperty('--secondary');
  root.classList.toggle('colored-header', Boolean(settings.coloredHeader));

  let storedTheme: string | null = null;
  try {
    storedTheme = localStorage.getItem(themeStorageKey);
  } catch {
    storedTheme = null;
  }
  root.dataset.theme = storedTheme || (settings.dark ? 'dark' : 'light');
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CommunityConfig>({
    configured: false,
    settings: {},
    auth_providers: [],
  });
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    try {
      const result = await api<{ user: CommunityUser }>('/api/me');
      setUser(result.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clearAuthSession();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    consumeAuthCallback();

    const loadConfig = api<CommunityConfig>('/api/config')
      .then((result) => {
        setConfig(result);
        applySettings(result.settings || {});
      })
      .catch(() => applySettings({}));

    void Promise.all([loadConfig, refreshUser()]).finally(() => setReady(true));

    const onAuthChange = () => void refreshUser();
    window.addEventListener(authChangeEvent, onAuthChange);
    return () => window.removeEventListener(authChangeEvent, onAuthChange);
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    if (getAccessToken()) {
      await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
    }
    clearAuthSession();
    setUser(null);
  }, []);

  const setSettings = useCallback((settings: CommunitySettings) => {
    setConfig((current) => ({ ...current, settings }));
    applySettings(settings);
  }, []);

  const value = useMemo<CommunityContextValue>(
    () => ({
      ready,
      configured: config.configured,
      settings: config.settings,
      authProviders: config.auth_providers || [],
      turnstileSiteKey: config.turnstile_site_key || '',
      user,
      isAdmin: user?.role === 'admin',
      refreshUser,
      signOut,
      setSettings,
    }),
    [config, ready, refreshUser, setSettings, signOut, user],
  );

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity() {
  const context = useContext(CommunityContext);
  if (!context) throw new Error('useCommunity must be used inside CommunityProvider');
  return context;
}

export function communityTitle(settings: CommunitySettings) {
  return String(settings.title || defaultCommunityTitle);
}

export { themeStorageKey };
