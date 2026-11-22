import type { Metadata } from 'next';

import { UsersPanel } from '@/components/admin/users-panel';

export const metadata: Metadata = { title: 'Users · Administration' };

export default function AdminUsersPage() {
  return <UsersPanel />;
}
