import { ApostilasFolder } from '@/components/mentoria/apostilas';
import { todayBR } from '@/lib/mentoria';
import { blocksOf } from '@/lib/mentoria-blocks';

export default async function GroupApostilas({ params }: { params: Promise<{ gid: string }> }) {
  const blocks = await blocksOf([`g:${(await params).gid}`]);
  return <ApostilasFolder groups={blocks} today={todayBR()} />;
}
