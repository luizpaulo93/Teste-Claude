'use client';

import { FileUp, ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { compressImage } from '@/lib/image';
import { uploadFile } from '@/lib/storage/client';
import { cn } from '@/lib/utils';

/** Upload de imagem para o bucket público `media`. Guarda a URL num input hidden `name`. */
export function ImageUpload({
  name,
  defaultValue = '',
  folder,
  aspect = 'aspect-[2/3]',
  hint,
  maxSize = 1400,
  className,
}: {
  name: string;
  defaultValue?: string;
  folder: string;
  aspect?: string;
  hint?: string;
  maxSize?: number;
  className?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file, maxSize, 0.86);
      const { publicUrl } = await uploadFile('media', folder, blob, blob.type || file.type);
      setUrl(publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no upload da imagem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <input type="hidden" name={name} value={url} />
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && ref.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'group relative grid w-full cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-surface-2/60 transition hover:border-brand',
          aspect,
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="p-3 text-center text-muted">
            <ImagePlus className="mx-auto size-6" />
            <p className="mt-1 text-[11px] font-semibold">Enviar imagem</p>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <Spinner className="text-white" />
          </div>
        )}
        {url && !busy && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUrl('');
            }}
            className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
            aria-label="Remover imagem"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function sizeLabel(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/** Upload de PDF para o bucket privado `materials`. */
export async function uploadPdf(file: File, folder: string) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Envie um arquivo PDF.');
  if (file.size > 50 * 1024 * 1024) throw new Error('O PDF deve ter no máximo 50 MB.');
  const { path } = await uploadFile('materials', folder, file, 'application/pdf');
  return { path, size: sizeLabel(file.size), title: file.name.replace(/\.pdf$/i, '') };
}

export function PdfDrop({
  onUploaded,
  onBatchDone,
  onBatchStart,
  folder,
  label = 'Adicionar PDF',
  multiple,
}: {
  onUploaded: (r: { path: string; size: string; title: string }) => void;
  /** Chamado quando todos os arquivos do lote terminaram */
  onBatchDone?: () => void;
  onBatchStart?: () => void;
  folder: string;
  label?: string;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    onBatchStart?.();
    setBusy(list.length);
    // Envia 3 por vez (mais rápido em lote, sem travar a conexão)
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const f = list[next++];
        try {
          onUploaded(await uploadPdf(f, folder));
        } catch (e) {
          toast.error(`${f.name}: ${e instanceof Error ? e.message : 'falha no upload.'}`);
        }
        setBusy((n) => n - 1);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker));
    onBatchDone?.();
    if (ref.current) ref.current.value = '';
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void onFiles(e.dataTransfer.files);
      }}
    >
      <input ref={ref} type="file" accept="application/pdf" multiple={multiple} className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <button type="button" disabled={busy > 0} onClick={() => ref.current?.click()} className={buttonClass('outline', 'md', 'w-full border-dashed')}>
        {busy > 0 ? <Spinner /> : multiple ? <UploadCloud className="size-4" /> : <FileUp className="size-4" />}
        {busy > 0 ? `Enviando ${busy}…` : label}
      </button>
    </div>
  );
}
