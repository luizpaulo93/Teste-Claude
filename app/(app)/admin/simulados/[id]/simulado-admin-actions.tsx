'use client';

import { Calculator, Eye, EyeOff, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { ActionButton, Modal } from '@/components/ui-client';
import type { Simulado } from '@/lib/types';
import { deleteSimulado, hideResults, releaseResults, resetSubmission, setSimuladoPublished } from '../../simulado-actions';
import { SimuladoForm } from '../simulado-form';

export function SimuladoAdminActions({ simulado, answerKey }: { simulado: Simulado; answerKey: string }) {
  const [edit, setEdit] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" onClick={() => setEdit(true)}>
        <Pencil className="size-4" /> Editar
      </Button>
      <ActionButton
        action={() => setSimuladoPublished(simulado.id, !simulado.is_published)}
        success={simulado.is_published ? 'Simulado despublicado' : 'Simulado publicado'}
        size="md"
      >
        {simulado.is_published ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {simulado.is_published ? 'Despublicar' : 'Publicar'}
      </ActionButton>
      <ActionButton
        action={() => releaseResults(simulado.id)}
        confirm={
          simulado.results_released
            ? 'Recalcular as notas com todas as entregas atuais?'
            : `Liberar resultados? Os alunos verão ${simulado.use_tri === false ? 'os acertos' : 'a nota TRI'}. Quem ainda está fazendo a prova pode entregar, e a turma é recalibrada a cada entrega.`
        }
        success={simulado.use_tri === false ? 'Resultados liberados' : 'Notas TRI calculadas e liberadas'}
        variant="primary"
        size="md"
      >
        <Calculator className="size-4" /> {simulado.results_released ? 'Recalcular' : 'Liberar resultados'}
      </ActionButton>
      {simulado.results_released && (
        <ActionButton action={() => hideResults(simulado.id)} success="Resultados ocultados" size="md" title="Ocultar resultados">
          <EyeOff className="size-4" /> Ocultar notas
        </ActionButton>
      )}
      <ActionButton
        action={async () => {
          const r = await deleteSimulado(simulado.id);
          if (!r.error) router.push('/admin/simulados');
          return r;
        }}
        confirm="Excluir este simulado com todas as entregas e notas?"
        success="Simulado excluído"
        variant="danger"
        size="md"
        title="Excluir"
      >
        <Trash2 className="size-4" />
      </ActionButton>
      <Modal open={edit} onClose={() => setEdit(false)} title="Editar simulado" size="lg">
        <SimuladoForm simulado={simulado} answerKey={answerKey} onSaved={() => setEdit(false)} />
      </Modal>
    </>
  );
}

export function ResetButton({ simuladoId, userId }: { simuladoId: string; userId: string }) {
  return (
    <ActionButton
      action={() => resetSubmission(simuladoId, userId)}
      confirm="Apagar a entrega deste aluno para ele refazer a prova?"
      success="Entrega apagada"
      variant="ghost"
      size="sm"
      title="Permitir refazer"
    >
      <RotateCcw className="size-3.5" />
    </ActionButton>
  );
}
