import type { Metadata } from 'next';

import { CategoriesPanel } from '@/components/admin/categories-panel';

export const metadata: Metadata = { title: 'Categories · Administration' };

export default function AdminCategoriesPage() {
  return <CategoriesPanel />;
}
