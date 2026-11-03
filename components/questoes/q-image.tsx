import { ImageOff } from 'lucide-react';
import type { QImg } from '@/lib/question-types';
import { cn } from '@/lib/utils';

/** Imagem da questão: fundo branco (também no tema escuro), do tamanho certo, sem estourar a tela. */
export function QImage({ img, className }: { img: QImg; className?: string }) {
  if (!img.url)
    return (
      <div className={cn('flex items-center gap-2 rounded-xl border border-dashed border-warning/40 p-3 text-xs text-warning', className)}>
        <ImageOff className="size-4 shrink-0" /> Imagem ainda não enviada ({img.arquivo.split('/').pop()})
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.url}
      alt={img.alt ?? ''}
      width={img.largura ?? undefined}
      height={img.altura ?? undefined}
      loading="lazy"
      className={cn('mx-auto block h-auto max-w-full rounded-lg bg-white p-1', className)}
      style={img.largura ? { width: `min(100%, ${img.largura}px)` } : undefined}
    />
  );
}
