import { CycleList } from '@/components/mentoria/cycle-view';
import { cyclesOf } from '@/lib/mentoria-cycles';

export default async function MentoradoPrevious({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  return <CycleList list={await cyclesOf(id)} base={`/admin/mentoria/${encodeURIComponent(id)}/anteriores`} />;
}
