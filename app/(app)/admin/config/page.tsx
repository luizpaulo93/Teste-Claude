import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { BOOTSTRAP_ADMIN, getSettings } from '@/lib/session';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Configurações · Admin' };

export default async function AdminConfig() {
  const [settings, rows] = await Promise.all([getSettings(), sql.query<{ email: string }>(`select email from admins`)]);
  const admins = [BOOTSTRAP_ADMIN, ...rows.map((r) => r.email)].filter((v, i, a) => a.indexOf(v) === i).sort();
  return (
    <>
      <PageHeader title="Configurações" subtitle="Identidade da plataforma, regras de acesso e administradores." />
      <SettingsForm settings={settings} admins={admins} />
    </>
  );
}
