import type { Metadata } from 'next';

import { SettingsPanel } from '@/components/admin/settings-panels';

export const metadata: Metadata = { title: 'Email · Administration' };

export default function AdminEmailPage() {
  return <SettingsPanel panel="email" />;
}
