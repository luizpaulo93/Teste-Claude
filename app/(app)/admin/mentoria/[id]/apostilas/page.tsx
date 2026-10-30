import { ApostilasFolder } from '@/components/mentoria/apostilas';
import { todayBR } from '@/lib/mentoria';
import { blocksOf, spacesOfMentoria } from '@/lib/mentoria-blocks';

/** Mesma pasta que o aluno vê: todas as apostilas da mentoria dele (individual e do grupo). */
export default async function MentoradoApostilas({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const blocks = await blocksOf(await spacesOfMentoria(id));
  return <ApostilasFolder groups={blocks} today={todayBR()} />;
}
