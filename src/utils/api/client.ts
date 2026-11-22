const accessTokenKey = 'community_access_token';
const refreshTokenKey = 'community_refresh_token';
export const authChangeEvent = 'community-auth-change';
/** Dispatched on `window` after notifications are marked read, so badges can refresh. */
export const notificationsChangeEvent = 'community-notifications-change';

export type AuthSession = {
  access_token: string;
  refresh_token?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function storages() {
  if (typeof window === 'undefined') return [];
  return [localStorage, sessionStorage];
}

export function getAccessToken() {
  for (const storage of storages()) {
    const token = storage.getItem(accessTokenKey);
    if (token) return token;
  }
  return '';
}

function getRefreshSession() {
  for (const storage of storages()) {
    const token = storage.getItem(refreshTokenKey);
    if (token) return { token, persistent: storage === localStorage };
  }
  return null;
}

export function storeAuthSession(session: AuthSession, persistent = true) {
  const storage = persistent ? localStorage : sessionStorage;
  const otherStorage = persistent ? sessionStorage : localStorage;
  storage.setItem(accessTokenKey, session.access_token);
  storage.setItem(refreshTokenKey, session.refresh_token || '');
  otherStorage.removeItem(accessTokenKey);
  otherStorage.removeItem(refreshTokenKey);
  window.dispatchEvent(new Event(authChangeEvent));
}

export function clearAuthSession() {
  for (const storage of storages()) {
    storage.removeItem(accessTokenKey);
    storage.removeItem(refreshTokenKey);
  }
  window.dispatchEvent(new Event(authChangeEvent));
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the stored refresh token for a new session. Concurrent callers share one request. */
function refreshSession() {
  const refresh = getRefreshSession();
  if (!refresh) return Promise.resolve(false);

  refreshInFlight ??= fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh.token }),
  })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.access_token) return false;
      storeAuthSession(body, refresh.persistent);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function send(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(path, { ...init, headers });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init);
  if (response.status === 401 && getAccessToken() && (await refreshSession())) {
    response = await send(path, init);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error || body.message || 'Request failed', response.status);
  }
  return body as T;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
