/**
 * In-process cache for public, viewer-independent reads (settings, categories, discussion
 * lists). Every Supabase round trip costs hundreds of milliseconds from the server, so pages
 * and the API answer from here and refresh in the background once an entry goes stale.
 *
 * The site runs as one container, so clearing the cache after a write (see `routes/index.js`)
 * is enough to keep every visitor consistent. Entries live on `globalThis` so route handlers
 * and server components share them even when Next.js bundles this module more than once.
 */
const store = (globalThis.__communityCache ??= new Map());

/**
 * Fresh entries are served as is. Stale ones are still served instantly while a background
 * refresh runs, so the first visitor after a quiet period never waits on the database; writes
 * through this server clear the cache, so staleness only affects changes made elsewhere.
 */
const defaultFreshMs = 15_000;
const defaultStaleMs = 24 * 60 * 60_000;
/** Discussion threads are cached one entry each; keep memory bounded. */
const maxEntries = 120;

function load(key, loader, generation, shouldStore) {
  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      // A write cleared the cache while this read ran; its result may predate the write.
      const current = store.get(key)?.pending === pending && generationOf() === generation;
      if (current && shouldStore(value)) store.set(key, { value, storedAt: Date.now() });
      else if (current) store.delete(key);
      return value;
    })
    .catch((error) => {
      const entry = store.get(key);
      if (entry?.pending === pending) {
        if ('value' in entry) store.set(key, { value: entry.value, storedAt: entry.storedAt });
        else store.delete(key);
      }
      throw error;
    });
  return pending;
}

function generationOf() {
  return (globalThis.__communityCacheGeneration ??= 0);
}

/**
 * Returns the cached value for `key`, loading it with `loader` when missing. A stale value is
 * returned immediately and refreshed in the background; concurrent misses share one request.
 * `shouldStore(value)` can veto caching a result, for example one too large to keep.
 */
async function cached(
  key,
  loader,
  { freshMs = defaultFreshMs, staleMs = defaultStaleMs, shouldStore = () => true } = {},
) {
  const now = Date.now();
  const entry = store.get(key);

  if (entry && 'value' in entry) {
    const age = now - entry.storedAt;
    if (age < freshMs) return entry.value;
    if (age < freshMs + staleMs) {
      if (!entry.pending) {
        const pending = load(key, loader, generationOf(), shouldStore);
        store.set(key, { ...entry, pending });
        pending.catch(() => undefined);
      }
      return entry.value;
    }
  }
  if (entry?.pending) return entry.pending;

  const pending = load(key, loader, generationOf(), shouldStore);
  store.delete(key);
  // Maps iterate in insertion order, so the first key is the least recently loaded entry.
  while (store.size >= maxEntries) store.delete(store.keys().next().value);
  store.set(key, { pending });
  return pending;
}

/**
 * Like `cached`, scoped to one Supabase project. Clients without a `cacheKey` (such as test
 * doubles) always load fresh data.
 */
function cachedFor(supabase, key, loader, options) {
  if (!supabase?.cacheKey) return Promise.resolve().then(loader);
  return cached(`${supabase.cacheKey}:${key}`, loader, options);
}

/** Drops every cached entry; call after any write that public reads could observe. */
function clearCache() {
  globalThis.__communityCacheGeneration = generationOf() + 1;
  store.clear();
}

export { cached, cachedFor, clearCache };
