'use client';

import { FileText, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PdfDrop } from '@/components/admin/uploads';
import { FileRow } from '@/components/mentoria/apostilas';
import { toast } from '@/components/toast';
import { ActionButton } from '@/components/ui-client';
import { addLiveMaterials, removeLiveMaterial } from '@/app/(app)/admin/live-actions';
import type { LessonMaterial } from '@/lib/types';

/** PDFs da live para o aluno (na sala e depois na gravação). */
export function LiveMaterialsList({ materials }: { materials: LessonMaterial[] }) {
  if (!materials.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-2">
      <p className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-sm font-bold text-ink">
        <FileText className="size-4 text-danger" /> Materiais da aula
      </p>
      {materials.map((m) => (
        <FileRow key={m.id} f={m} />
      ))}
    </div>
  );
}

/** Professor sobe PDFs durante a live ou depois de encerrada (também vão para a aula salva). */
export function LiveMaterialsAdmin({ liveId, materials }: { liveId: string; materials: LessonMaterial[] }) {
  const router = useRouter();
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ink-2">PDFs da live</p>
      {materials.map((m) => (
        <div key={m.id} className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <FileRow f={m} />
          </div>
          <ActionButton action={() => removeLiveMaterial(liveId, m.id)} confirm="Tirar este PDF da live?" success="PDF removido" variant="ghost" size="sm" className="px-2 hover:text-danger" title="Tirar PDF">
            <Trash2 className="size-4" />
          </ActionButton>
        </div>
      ))}
      <PdfDrop
        folder="lives/pdfs"
        multiple
        label="Subir PDF"
        onUploaded={async (r) => {
          const res = await addLiveMaterials(liveId, [r]);
          if (res.error) toast.error(res.error);
        }}
        onBatchDone={() => {
          toast('PDF enviado: os alunos já veem na sala.');
          router.refresh();
        }}
      />
    </div>
  );
}
