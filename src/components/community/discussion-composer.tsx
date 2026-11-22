'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { RichEditor } from '@/components/editor/rich-editor';
import { useCommunity } from '@/components/session/community-provider';
import { normalizeCategory } from '@/lib/forum';
import type { ForumCategory } from '@/lib/forum';
import { api, errorMessage } from '@/utils/api/client';

type ComposerProps = { mode: 'create' } | { mode: 'edit'; discussionId: string };

type LoadedDiscussion = { title: string; content: string; categoryId: string };

export function DiscussionComposer(props: ComposerProps) {
  const router = useRouter();
  const { ready, user, isAdmin } = useCommunity();
  const editing = props.mode === 'edit';
  const discussionId = editing ? props.discussionId : '';
  const encodedId = encodeURIComponent(discussionId);
  const returnPath = editing ? `/discussions/${encodedId}/edit` : '/discussions/new';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [initialContent, setInitialContent] = useState<string | null>(editing ? null : '');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<ForumCategory[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
  }, [ready, returnPath, router, user]);

  useEffect(() => {
    if (!ready || !user) return;
    Promise.all([
      api<{ categories?: unknown[] }>('/api/categories'),
      editing
        ? api<{ discussion: Record<string, any> }>(`/api/discussions/${encodedId}`)
        : Promise.resolve(null),
    ])
      .then(([result, thread]) => {
        setCategories(
          (result.categories || [])
            .map(normalizeCategory)
            .filter((category): category is ForumCategory => Boolean(category)),
        );
        if (editing) {
          const match = thread?.discussion;
          if (!match) throw new Error('Discussion not found');
          const loaded: LoadedDiscussion = {
            title: match.title || '',
            content: match.content || '',
            categoryId: match.category_id ? String(match.category_id) : '',
          };
          setTitle(loaded.title);
          setCategoryId(loaded.categoryId);
          setContent(loaded.content);
          setInitialContent(loaded.content);
        }
      })
      .catch((loadError) => {
        setCategories((current) => current || []);
        setError(errorMessage(loadError, 'Could not load the discussion'));
      });
  }, [editing, encodedId, ready, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 6) return setError('The title needs at least 6 characters.');
    if (content.trim().length < 10) return setError('Add a little more detail (10+ characters).');
    if (!categoryId) return setError('Choose a category for the discussion.');
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await api(`/api/admin/discussions/${encodedId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, content, category_id: categoryId }),
        });
        router.push(`/discussions/${encodedId}`);
      } else {
        const result = await api<{ discussion: { id: string } }>('/api/discussions', {
          method: 'POST',
          body: JSON.stringify({
            title,
            content,
            category_id: categoryId,
          }),
        });
        router.push(`/discussions/${encodeURIComponent(result.discussion.id)}`);
      }
    } catch (submitError) {
      setError(errorMessage(submitError, 'Could not save the discussion'));
      setBusy(false);
    }
  }

  if (!ready || !user) {
    return (
      <main className="content-page composer-page">
        <div className="empty-state" aria-busy="true">
          <p>Checking your account…</p>
        </div>
      </main>
    );
  }

  if (editing && !isAdmin) {
    return (
      <main className="content-page composer-page">
        <div className="empty-state">
          <h1>Administrator access required</h1>
          <p>Only community administrators can edit discussions.</p>
          <Link className="button button-primary" href={`/discussions/${encodedId}`}>
            Back to discussion
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="content-page composer-page">
      <header>
        <p>{editing ? 'Moderation' : 'Start something useful'}</p>
        <h1>{editing ? 'Edit discussion' : 'New discussion'}</h1>
        <span>
          {editing
            ? 'Update the title or opening post. Replies are not changed.'
            : 'Give people enough context to understand your idea and join the conversation.'}
        </span>
      </header>
      <form className="composer-card" onSubmit={submit}>
        <label>
          <span>Discussion title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            minLength={6}
            maxLength={140}
            required
            placeholder="What would you like to discuss?"
          />
        </label>
        <label>
          <span>Category</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            disabled={categories === null}
          >
            <option value="" disabled>
              {categories === null
                ? 'Loading categories…'
                : categories.length
                  ? 'Choose a category'
                  : 'No categories available'}
            </option>
            {(categories || []).map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {categories?.length === 0 ? (
            <small>
              {isAdmin ? (
                <>
                  Create a category in <Link href="/admin/categories">Administration</Link> first.
                </>
              ) : (
                'An administrator needs to create a category before discussions can be started.'
              )}
            </small>
          ) : null}
        </label>
        <div className="composer-field">
          <span id="composer-content-label">Content</span>
          {initialContent === null ? (
            <div className="empty-state" aria-busy="true">
              <p>Loading content…</p>
            </div>
          ) : (
            <RichEditor
              id="composer-content"
              label="Discussion content"
              placeholder="Add details, examples, and the question you want the community to answer…"
              initialValue={initialContent}
              onChange={setContent}
            />
          )}
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="composer-actions">
          <button className="button" type="button" onClick={() => router.back()}>
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy || !categories?.length}
          >
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish discussion'}
          </button>
        </div>
      </form>
    </main>
  );
}
