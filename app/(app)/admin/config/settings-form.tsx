'use client';

import { FlaskConical, ShieldCheck, Trash2 } from 'lucide-react';
import { ActionForm } from '@/components/admin/action-form';
import { ImageUpload } from '@/components/admin/uploads';
import { Card, Field, Input } from '@/components/ui';
import { ActionButton, SubmitButton, Switch } from '@/components/ui-client';
import type { PlatformSettings } from '@/lib/types';
import { loadDemo, removeDemo } from '../demo-actions';
import { addAdmin, removeAdmin, saveSettings } from '../misc-actions';

export function SettingsForm({ settings, admins }: { settings: PlatformSettings; admins: string[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="p-5">
        <ActionForm action={saveSettings} success="Configurações salvas" className="space-y-4">
          <Field label="Nome da marca">
            <Input name="brand_name" defaultValue={settings.brand_name} maxLength={80} />
          </Field>
          <Field label="Título de boas-vindas">
            <Input name="hero_title" defaultValue={settings.hero_title} maxLength={160} />
          </Field>
          <Field label="Subtítulo">
            <Input name="hero_subtitle" defaultValue={settings.hero_subtitle} maxLength={240} />
          </Field>
          <Field label="Texto do botão principal">
            <Input name="hero_cta" defaultValue={settings.hero_cta} maxLength={60} />
          </Field>
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-ink-2">Imagem de fundo (login e topo da home)</span>
            <ImageUpload name="hero_bg_url" defaultValue={settings.hero_bg_url} folder="platform" aspect="aspect-video" maxSize={1920} hint="1920 × 1080 px" />
          </div>
          <Switch
            name="restrict_to_student_list"
            defaultChecked={settings.restrict_to_student_list}
            label="Restringir à lista de alunos"
            description="Ligado: só e-mails cadastrados em Alunos (com turma) acessam conteúdo pago. Desligado: qualquer pessoa logada acessa tudo."
          />
          <div className="flex justify-end">
            <SubmitButton>Salvar configurações</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <div className="space-y-6 xl:self-start">
      <Card className="border-brand/30 p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <FlaskConical className="size-4 text-brand" /> Conteúdo de exemplo
        </p>
        <p className="mt-1 mb-4 text-xs text-muted">
          Cria cursos, aulas, uma turma, um simulado, uma live e eventos de exemplo para testar a plataforma. Depois é só apagar.
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton action={loadDemo} success="Conteúdo de exemplo criado" variant="primary" size="md">
            Carregar exemplos
          </ActionButton>
          <ActionButton action={removeDemo} confirm="Apagar todo o conteúdo de exemplo?" success="Conteúdo de exemplo apagado" variant="danger" size="md">
            Apagar exemplos
          </ActionButton>
        </div>
      </Card>
      <Card className="p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldCheck className="size-4 text-brand" /> Administradores
        </p>
        <p className="mt-1 mb-4 text-xs text-muted">Têm acesso total ao painel. Use o mesmo e-mail do login.</p>
        <ul className="mb-4 space-y-2">
          {admins.map((email) => (
            <li key={email} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-ink">{email}</span>
              <ActionButton action={() => removeAdmin(email)} confirm={`Remover ${email} dos administradores?`} success="Administrador removido" variant="ghost" size="sm" className="px-1.5 hover:text-danger" title="Remover">
                <Trash2 className="size-3.5" />
              </ActionButton>
            </li>
          ))}
        </ul>
        <ActionForm action={addAdmin} success="Administrador adicionado" resetOnSuccess className="flex gap-2">
          <Input name="email" type="email" required placeholder="email@exemplo.com" className="h-10" />
          <SubmitButton size="md" pendingText="…">
            Adicionar
          </SubmitButton>
        </ActionForm>
      </Card>
      </div>
    </div>
  );
}
