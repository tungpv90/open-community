import type { Metadata } from 'next';

import { DiscussionDetail } from '@/components/community/discussion-detail';

export const metadata: Metadata = { title: 'Discussion' };

export default async function DiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DiscussionDetail discussionId={id} />;
}
