import type { Metadata } from 'next';
import { WeekView } from '@/components/mentoria/week-view';
import { emailKey } from '@/lib/db';
import { DISCIPLINES } from '@/lib/enem-matriz';
import { cards, ensureFresh, getMentoria } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Semana · Mentoria' };

export default async function MentoriaWeek() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  await ensureFresh(m.id);
  return <WeekView cards={await cards(m.id)} availability={m.availability} names={Object.fromEntries(DISCIPLINES.map((d) => [d.key, d.name]))} />;
}
