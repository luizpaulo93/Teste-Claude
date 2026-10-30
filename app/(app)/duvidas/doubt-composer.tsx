'use client';

import { ImagePlus, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { Avatar, buttonClass, Card } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { compressImage } from '@/lib/image';
import { uploadFile } from '@/lib/storage/client';
import { addReply, createDoubt } from './actions';

export async function uploadDoubtImage(userId: string, file: File) {
  const blob = await compressImage(file, 1600);
  const { publicUrl } = await uploadFile('media', `doubts/${userId}`, blob, blob.type || file.type);
  return publicUrl;
}

export function DoubtComposer({
  userId,
  name,
  avatar,
  doubtId,
  onDone,
  compact,
  space,
}: {
  userId: string;
  name: string;
  avatar: string;
  doubtId?: string;
  onDone?: () => void;
  compact?: boolean;
  /** espaço da mentoria (m:… ou g:…) */
  space?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : '');
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const image_url = file ? await uploadDoubtImage(userId, file) : '';
      const r = doubtId ? await addReply(doubtId, text.trim(), image_url) : await createDoubt(text.trim(), image_url, space ?? '');
      if (r.error) throw new Error(r.error);
      setText('');
      pick(null);
      toast(doubtId ? 'Resposta enviada' : 'Dúvida publicada');
      onDone?.();
      router.refresh();
    } catch {
      toast.error('Não foi possível enviar. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  const form = (
    <form onSubmit={submit} className="flex gap-3">
      {!compact && <Avatar name={name} src={avatar} size={40} className="hidden sm:grid sm:block" />}
      <div className="min-w-0 flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={doubtId ? 'Escreva uma resposta…' : 'Qual é a sua dúvida? Descreva a questão ou envie uma foto.'}
          maxLength={4000}
          rows={compact ? 2 : 3}
          className="w-full resize-none rounded-xl border border-line-strong bg-bg-elev px-3.5 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
        />
        {preview && (
          <div className="relative mt-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="max-h-40 rounded-xl border border-line" />
            <button type="button" onClick={() => pick(null)} className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-danger text-white" aria-label="Remover imagem">
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => inputRef.current?.click()} className={buttonClass('ghost', 'sm')}>
            <ImagePlus className="size-4" /> Foto
          </button>
          <button type="submit" disabled={sending || !text.trim()} className={buttonClass('primary', 'sm')}>
            {sending ? <Spinner /> : <Send className="size-3.5" />} {doubtId ? 'Responder' : 'Publicar'}
          </button>
        </div>
      </div>
    </form>
  );

  return compact ? form : <Card className="p-4 sm:p-5">{form}</Card>;
}
