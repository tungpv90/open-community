import type { Metadata } from 'next';

import { SettingsPanel } from '@/components/admin/settings-panels';

export const metadata: Metadata = { title: 'Header menu · Administration' };

export default function AdminHeaderPage() {
  return <SettingsPanel panel="header" />;
}
