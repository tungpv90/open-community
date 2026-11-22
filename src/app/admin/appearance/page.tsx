import type { Metadata } from 'next';

import { SettingsPanel } from '@/components/admin/settings-panels';

export const metadata: Metadata = { title: 'Appearance · Administration' };

export default function AdminAppearancePage() {
  return <SettingsPanel panel="appearance" />;
}
