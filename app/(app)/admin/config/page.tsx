import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { db } from '@/lib/db';
import { BOOTSTRAP_ADMIN, getSettings } from '@/lib/session';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Configurações · Admin' };

export default async function AdminConfig() {
  const [settings, snap] = await Promise.all([getSettings(), db().collection('admins').get()]);
  const admins = [BOOTSTRAP_ADMIN, ...snap.docs.map((d) => String(d.get('email')))].filter((v, i, a) => a.indexOf(v) === i).sort();
  return (
    <>
      <PageHeader title="Configurações" subtitle="Identidade da plataforma, regras de acesso e administradores." />
      <SettingsForm settings={settings} admins={admins} />
    </>
  );
}
