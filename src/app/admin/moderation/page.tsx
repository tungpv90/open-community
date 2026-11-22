import type { Metadata } from 'next';

import { ModerationPanel } from '@/components/admin/content-panels';

export const metadata: Metadata = { title: 'Moderation · Administration' };

export default function AdminModerationPage() {
  return <ModerationPanel />;
}
