import type { Metadata } from 'next';

import { GroupsPanel } from '@/components/admin/groups-panel';

export const metadata: Metadata = { title: 'Groups · Administration' };

export default function AdminGroupsPage() {
  return <GroupsPanel />;
}
