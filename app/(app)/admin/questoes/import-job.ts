'use client';

/**
 * Importação de provas que continua enquanto o admin navega pelo app (não depende da tela do importador).
 * Ordem segura: grava as questões primeiro e depois envia as imagens em lotes, encaixando cada lote.
 * Se a página for fechada no meio, as questões e as imagens já enviadas ficam; escolher as imagens de novo
 * envia só as que faltam.
 */
import { useSyncExternalStore } from 'react';
import type { ProvaIn } from '@/lib/question-types';
import { uploadFile } from '@/lib/storage/client';
import { attachPaperImages, importPaper } from './actions';

export interface ImportState {
  running: boolean;
  label: string;
  done: number;
  total: number;
  log: string[];
  /** resumo ao terminar */
  result: string | null;
  /** muda a cada importação concluída (a tela atualiza a lista de provas) */
  finished: number;
}

let state: ImportState = { running: false, label: '', done: 0, total: 0, log: [], result: null, finished: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<ImportState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useImportJob = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
export const clearImportResult = () => set({ result: null, log: [] });

const typeOf = (f: File) => f.type || (/\.webp$/i.test(f.name) ? 'image/webp' : /\.png$/i.test(f.name) ? 'image/png' : 'image/jpeg');
const BATCH = 25;

// fechar a aba no meio: o navegador pergunta antes
const warn = (e: BeforeUnloadEvent) => e.preventDefault();
// celular: a tela não apaga enquanto envia (a aba em segundo plano pode ser pausada pelo sistema)
type Lock = { release: () => Promise<void> };
async function keepAwake(): Promise<Lock | null> {
  try {
    return await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }).wakeLock?.request('screen') ?? null;
  } catch {
    return null;
  }
}

export interface ImportJob {
  /** provas para gravar (com as imagens que o app já tem) */
  provas: { prova: ProvaIn; have: Record<string, string> }[];
  /** imagens para enviar e encaixar */
  uploads: { prova: string; name: string; file: File }[];
}

export async function startImport(job: ImportJob) {
  if (state.running) return;
  set({ running: true, label: 'Preparando', done: 0, total: 0, log: [], result: null });
  window.addEventListener('beforeunload', warn);
  let lock = await keepAwake();
  const relock = async () => {
    if (document.visibilityState === 'visible' && state.running) lock = await keepAwake();
  };
  document.addEventListener('visibilitychange', relock);
  const log = (m: string) => set({ log: [...state.log, m] });
  try {
    // 1) questões primeiro: já ficam no app mesmo se as imagens pararem no meio
    let questions = 0;
    for (const [k, { prova, have }] of job.provas.entries()) {
      set({ label: `Gravando questões (${prova.provaId})`, done: k, total: job.provas.length });
      const r = await importPaper(prova, have).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'falhou' }));
      if (r.ok) questions += r.questions;
      else log(`${prova.provaId}: ${r.error}`);
    }

    // 2) imagens em lotes: cada lote enviado já é encaixado nas questões
    const total = job.uploads.length;
    let sent = 0;
    let placed = 0;
    let next = 0;
    const pending = new Map<string, Record<string, string>>();
    let chain: Promise<void> = Promise.resolve();
    const flush = (prova: string, force = false) => {
      const batch = pending.get(prova);
      if (!batch || (!force && Object.keys(batch).length < BATCH)) return;
      pending.delete(prova);
      chain = chain.then(async () => {
        const r = await attachPaperImages(prova, batch).catch(() => null);
        if (r) placed += Object.keys(batch).length;
        else log(`${prova}: não foi possível encaixar ${Object.keys(batch).length} imagens (envie de novo depois)`);
      });
    };
    if (total) set({ label: 'Enviando imagens', done: 0, total });
    const worker = async () => {
      while (next < total) {
        const j = job.uploads[next++];
        try {
          const r = await uploadFile('media', `questoes/${j.prova}`, j.file, typeOf(j.file));
          const b = pending.get(j.prova) ?? {};
          b[j.name] = r.publicUrl;
          pending.set(j.prova, b);
          flush(j.prova);
        } catch (e) {
          log(`Imagem ${j.name}: ${e instanceof Error ? e.message : 'falhou'}`);
        }
        set({ done: ++sent });
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    for (const prova of [...pending.keys()]) flush(prova, true);
    set({ label: 'Encaixando imagens' });
    await chain;

    const parts = [
      job.provas.length ? `${job.provas.length} prova(s), ${questions} questões importadas` : '',
      total ? `${placed} de ${total} imagens no lugar` : '',
    ].filter(Boolean);
    set({ result: `${parts.join(' · ')}.`, finished: state.finished + 1 });
  } catch (e) {
    log(e instanceof Error ? e.message : 'Falha na importação.');
    set({ result: 'A importação parou. O que já foi enviado ficou no app; escolha as imagens de novo para mandar só as que faltam.', finished: state.finished + 1 });
  } finally {
    window.removeEventListener('beforeunload', warn);
    document.removeEventListener('visibilitychange', relock);
    await lock?.release().catch(() => null);
    set({ running: false, label: '', done: 0, total: 0 });
  }
}
