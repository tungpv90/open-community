import type { Metadata } from 'next';

import { DiscussionComposer } from '@/components/community/discussion-composer';

export const metadata: Metadata = { title: 'New discussion' };

export default function NewDiscussionPage() {
  return <DiscussionComposer mode="create" />;
}
