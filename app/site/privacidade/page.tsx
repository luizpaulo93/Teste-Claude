import type { Metadata } from 'next';
import { LegalPage } from '@/components/landing/legal-page';
import { WHATSAPP_NUMBER } from '@/lib/contact';

export const metadata: Metadata = { title: 'Política de Privacidade — Curso Vértice' };

export default function Privacy() {
  return (
    <LegalPage title="Política de Privacidade" updated="31 de outubro de 2026">
      <p>
        Esta política explica quais dados a plataforma Curso Vértice coleta, para que usa e como você pode pedir acesso, correção ou exclusão, conforme a Lei Geral de
        Proteção de Dados (Lei 13.709/2018).
      </p>

      <h2>Dados que coletamos</h2>
      <ul>
        <li>Dados de conta: nome, e-mail e foto do login com Google ou por link de e-mail.</li>
        <li>Dados do perfil: nome completo, data de nascimento, CPF e telefone.</li>
        <li>Dados de estudo: aulas assistidas, progresso, respostas de simulados, cronograma e desempenho na mentoria, dúvidas e mensagens no chat das aulas ao vivo.</li>
        <li>Arquivos que você envia (por exemplo, fotos de dúvidas).</li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Liberar o acesso aos cursos da sua turma e montar o seu cronograma.</li>
        <li>Mostrar o seu desempenho a você e ao seu mentor.</li>
        <li>
          Proteger o material do curso: os PDFs abertos na plataforma recebem o seu nome, e-mail, CPF e telefone em cada página, para desestimular o compartilhamento.
        </li>
        <li>Responder dúvidas e avisar sobre aulas ao vivo.</li>
      </ul>
      <p>Não vendemos nem alugamos os seus dados.</p>

      <h2>Com quem compartilhamos</h2>
      <p>Apenas com os serviços que fazem a plataforma funcionar, que tratam os dados em nosso nome:</p>
      <ul>
        <li>Google Firebase (login), Neon (banco de dados), Cloudflare R2 (arquivos) e Vercel (hospedagem).</li>
        <li>YouTube, para exibir as aulas em vídeo e as transmissões ao vivo.</li>
      </ul>

      <h2>Uso das APIs do Google e do YouTube</h2>
      <p>
        A plataforma usa os Serviços de API do YouTube. Somente o administrador do curso conecta a própria conta do YouTube, para que a plataforma crie e encerre as
        transmissões ao vivo no canal do curso. Alunos não conectam contas do YouTube.
      </p>
      <ul>
        <li>Dados acessados: o nome do canal e as transmissões ao vivo criadas pela plataforma.</li>
        <li>O token de acesso fica guardado apenas no servidor, nunca no navegador, e pode ser desconectado a qualquer momento em Admin → Ao vivo.</li>
        <li>
          O uso e a transferência de informações recebidas das APIs do Google seguem a{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-brand underline" target="_blank" rel="noopener noreferrer">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado.
        </li>
        <li>
          Ao usar a plataforma você também está sujeito aos{' '}
          <a href="https://www.youtube.com/t/terms" className="text-brand underline" target="_blank" rel="noopener noreferrer">
            Termos de Serviço do YouTube
          </a>{' '}
          e à{' '}
          <a href="https://policies.google.com/privacy" className="text-brand underline" target="_blank" rel="noopener noreferrer">
            Política de Privacidade do Google
          </a>
          . O acesso pode ser revogado também em{' '}
          <a href="https://myaccount.google.com/permissions" className="text-brand underline" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </li>
      </ul>

      <h2>Por quanto tempo guardamos</h2>
      <p>Enquanto a sua conta estiver ativa ou enquanto for necessário para cumprir obrigações legais. Você pode pedir a exclusão a qualquer momento.</p>

      <h2>Seus direitos</h2>
      <p>Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos.</p>

      <h2>Contato</h2>
      <p>
        Fale com a coordenação pelo WhatsApp{' '}
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="text-brand underline" target="_blank" rel="noopener noreferrer">
          (91) 98046-1223
        </a>
        .
      </p>
    </LegalPage>
  );
}
