import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DiscussionDetail } from '@/components/community/discussion-detail';
import { contentExcerpt } from '@/lib/rich-content';
import { loadThreadData } from '@/utils/server-data';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const thread = await loadThreadData(id);
  if (!thread) return { title: 'Discussion' };
  return {
    title: String(thread.discussion.title || 'Discussion'),
    description: contentExcerpt(String(thread.discussion.content || '')) || undefined,
  };
}

export default async function DiscussionPage({ params }: Props) {
  const { id } = await params;
  const thread = await loadThreadData(id);
  // undefined means the server could not reach the database; the browser then retries.
  if (thread === null) notFound();
  return <DiscussionDetail discussionId={id} initialThread={thread} />;
}
