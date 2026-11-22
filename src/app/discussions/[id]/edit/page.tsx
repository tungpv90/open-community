import type { Metadata } from 'next';

import { DiscussionComposer } from '@/components/community/discussion-composer';

export const metadata: Metadata = { title: 'Edit discussion' };

export default async function EditDiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DiscussionComposer mode="edit" discussionId={id} />;
}
