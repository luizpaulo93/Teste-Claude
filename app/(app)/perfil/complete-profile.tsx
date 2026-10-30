'use client';

import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/toast';
import { Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/ui-client';
import { completeProfile } from './actions';

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
};

/** Tela que aparece a partir do 3º dia até o aluno completar o perfil. */
export function CompleteProfile({
  profile,
  email,
  cpfLocked,
}: {
  profile: { full_name: string; birth_date: string | null };
  email: string;
  /** CPF já cadastrado (pelo mentor ou antes): só mostra, não deixa mudar */
  cpfLocked: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(completeProfile, null);
  // Campos controlados: se algo der errado, o que o aluno digitou continua lá
  const [v, setV] = useState({ full_name: profile.full_name, birth_date: profile.birth_date ?? '', cpf: '' });
  const bind = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: k === 'cpf' ? maskCpf(e.target.value) : e.target.value })) });
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.ok) {
      toast('Perfil completo. Bons estudos!');
      router.refresh();
    }
  }, [state, router]);
  return (
    <div className="mx-auto max-w-md py-6">
      <div className="rounded-3xl border border-brand/40 bg-surface p-5 shadow-card sm:p-6">
        <div className="grid size-12 place-items-center rounded-2xl bg-brand/12 text-brand">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">Complete seu perfil</h1>
        <p className="mt-1 text-sm text-ink-2">Para continuar usando a plataforma, preencha seus dados. Eles identificam os seus materiais e protegem o conteúdo do curso.</p>
        <form action={action} className="mt-5 space-y-4">
          <Field label="Nome completo">
            <Input {...bind('full_name')} required maxLength={120} autoComplete="name" placeholder="Nome e sobrenome" />
          </Field>
          <Field label="Data de nascimento">
            <Input {...bind('birth_date')} type="date" required />
          </Field>
          <Field label="CPF" hint={cpfLocked ? 'Cadastrado pelo mentor. Só ele pode alterar.' : 'Depois de salvo, só o mentor pode alterar.'}>
            {cpfLocked ? (
              <Input value={maskCpf(cpfLocked)} disabled readOnly />
            ) : (
              <Input {...bind('cpf')} required inputMode="numeric" placeholder="000.000.000-00" />
            )}
          </Field>
          <Field label="E-mail" hint="Só o mentor pode alterar.">
            <Input value={email} disabled readOnly />
          </Field>
          <SubmitButton className="w-full">Salvar e continuar</SubmitButton>
        </form>
      </div>
    </div>
  );
}
