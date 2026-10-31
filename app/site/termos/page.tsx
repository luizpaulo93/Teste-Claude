import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/landing/legal-page';

export const metadata: Metadata = { title: 'Termos de Uso — Curso Vértice' };

export default function Terms() {
  return (
    <LegalPage title="Termos de Uso" updated="31 de outubro de 2026">
      <p>Ao usar a plataforma Curso Vértice, você concorda com estes termos.</p>

      <h2>Acesso</h2>
      <ul>
        <li>O acesso é pessoal e intransferível. Não compartilhe o seu login.</li>
        <li>O acesso aos cursos depende da sua turma ou mentoria ativa.</li>
        <li>Para continuar usando a plataforma, mantenha o perfil completo (nome, data de nascimento e CPF).</li>
      </ul>

      <h2>Conteúdo</h2>
      <ul>
        <li>Aulas, apostilas, simulados e demais materiais são protegidos por direitos autorais e servem apenas para o seu estudo.</li>
        <li>É proibido copiar, gravar, revender ou compartilhar o material. Os PDFs saem identificados com os seus dados em cada página.</li>
        <li>As aulas em vídeo e ao vivo usam o YouTube e estão sujeitas aos Termos de Serviço do YouTube.</li>
      </ul>

      <h2>Conduta</h2>
      <p>Mantenha o respeito nas dúvidas e no chat das aulas ao vivo. Mensagens ofensivas podem ser apagadas e o acesso, suspenso.</p>

      <h2>Privacidade</h2>
      <p>
        O uso dos seus dados está descrito na{' '}
        <Link href="/site/privacidade" className="text-brand underline">
          Política de Privacidade
        </Link>
        .
      </p>

      <h2>Mudanças</h2>
      <p>Estes termos podem ser atualizados. A data no topo mostra a versão em vigor.</p>
    </LegalPage>
  );
}
