import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { getSettings } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Configurações · Admin' };

export default async function AdminConfig() {
  const supabase = await createClient();
  const [settings, { data: admins }] = await Promise.all([getSettings(), supabase.from('admin_emails').select('email').order('email')]);
  return (
    <>
      <PageHeader title="Configurações" subtitle="Identidade da plataforma, regras de acesso e administradores." />
      <SettingsForm settings={settings} admins={(admins ?? []).map((a: { email: string }) => a.email)} />
    </>
  );
}
