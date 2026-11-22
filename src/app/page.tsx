import { ForumHome } from '@/components/community/forum-home';
import { loadHomeData } from '@/utils/server-data';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [initialData, params] = await Promise.all([loadHomeData(), searchParams]);
  const category = typeof params.category === 'string' ? params.category : '';
  return <ForumHome initialData={initialData} initialCategory={category} />;
}
