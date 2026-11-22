import type { Metadata } from 'next';

import { TagsPanel } from '@/components/admin/content-panels';

export const metadata: Metadata = { title: 'Tags · Administration' };

export default function AdminTagsPage() {
  return <TagsPanel />;
}
