import { json } from '../http/responses.js';
import { cachedFor } from '../services/cache.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const colorPattern = /^#[0-9a-f]{3,8}$/i;

function categorySlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Validates admin category input. Returns `{ error }` or `{ values }` ready for PostgREST. */
function parseCategoryInput(input) {
  const name = String(input?.name || '').trim();
  const slug = categorySlug(input?.slug || name);
  const description = String(input?.description || '').trim();
  const color = String(input?.color || '#e7672e').trim();

  if (name.length < 2 || name.length > 60) {
    return { error: 'Category name must be between 2 and 60 characters' };
  }
  if (!slug) return { error: 'Category slug is required' };
  if (description.length > 300) {
    return { error: 'Category description must be 300 characters or fewer' };
  }
  if (!colorPattern.test(color)) return { error: 'Category color must be a hex color' };

  return { values: { name, slug, description, color } };
}

/** Lists categories in display order with the number of discussions visible to the caller. */
function listCategories(supabase, token = '') {
  // Anonymous results are the same for every visitor, so they are shared.
  if (!token) return cachedFor(supabase, 'categories', () => fetchCategories(supabase));
  return fetchCategories(supabase, token);
}

async function fetchCategories(supabase, token = '') {
  const select = encodeURIComponent(
    'id,name,slug,description,color,position,discussions:forum_discussions(count)',
  );
  const { body } = await supabase.request(
    `/rest/v1/forum_categories?select=${select}&order=position.asc,name.asc`,
    { method: 'GET' },
    token,
  );
  return (body || []).map(({ discussions, ...category }) => ({
    ...category,
    discussion_count: Number(discussions?.[0]?.count || 0),
  }));
}

/** Returns the category with `categoryId`, or null when the id is malformed or unknown. */
async function findCategory(supabase, categoryId, token = '') {
  const id = String(categoryId || '');
  if (!uuidPattern.test(id)) return null;
  const { body } = await supabase.request(
    `/rest/v1/forum_categories?id=eq.${encodeURIComponent(id)}&select=id,name,slug,color`,
    { method: 'GET' },
    token,
  );
  return body?.[0] || null;
}

async function handleCategoryRoute(request, url, supabase) {
  if (url.pathname === '/api/categories' && request.method === 'GET') {
    return json({ categories: await listCategories(supabase) });
  }
  return null;
}

export { findCategory, handleCategoryRoute, listCategories, parseCategoryInput };
