import type { Metadata } from 'next';

import { DiscussionsPanel } from '@/components/admin/content-panels';

export const metadata: Metadata = { title: 'Discussions · Administration' };

export default function AdminDiscussionsPage() {
  return <DiscussionsPanel />;
}
