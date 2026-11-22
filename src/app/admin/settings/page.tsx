import type { Metadata } from 'next';

import { SettingsPanel } from '@/components/admin/settings-panels';

export const metadata: Metadata = { title: 'Basics · Administration' };

export default function AdminSettingsPage() {
  return <SettingsPanel panel="basics" />;
}
