'use client';

import { useActionState, useEffect } from 'react';
import { toast } from '@/components/toast';
import { Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/ui-client';
import type { Profile } from '@/lib/types';
import { updateProfile } from './actions';

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateProfile, null);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.ok) toast('Perfil atualizado');
  }, [state]);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nome completo">
        <Input name="full_name" defaultValue={profile.full_name} required minLength={2} maxLength={120} autoComplete="name" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="WhatsApp">
          <Input name="phone" defaultValue={profile.phone} inputMode="tel" autoComplete="tel" placeholder="(91) 90000-0000" />
        </Field>
        <Field label="Data de nascimento">
          <Input name="birth_date" type="date" defaultValue={profile.birth_date ?? ''} />
        </Field>
      </div>
      <SubmitButton>Salvar alterações</SubmitButton>
    </form>
  );
}
