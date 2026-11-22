import type { Metadata } from 'next';

import { OverviewPanel } from '@/components/admin/overview-panel';

export const metadata: Metadata = { title: 'Administration' };

export default function AdminPage() {
  return <OverviewPanel />;
}
