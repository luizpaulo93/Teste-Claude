'use client';

/**
 * Importação de provas que continua enquanto o admin navega pelo app (não depende da tela do importador).
 * Ordem segura: grava as questões primeiro e depois envia as imagens em lotes, encaixando cada lote.
 * Se a página for fechada no meio, as questões e as imagens já enviadas ficam; escolher as imagens de novo
 * envia só as que faltam.
 */
import { useSyncExternalStore } from 'react';
import type { ProvaIn } from '@/lib/question-types';
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
/** imagens encaixadas por vez */
const BATCH = 50;
/** URLs de envio pedidas por vez (uma ida ao servidor para várias imagens) */
const SIGN = 50;
/** imagens subindo ao mesmo tempo */
const PARALLEL = 8;

type Signed = { uploadUrl: string; headers: Record<string, string>; publicUrl: string; error?: string };
async function signMany(prova: string, files: File[]): Promise<Signed[]> {
  const res = await fetch('/api/storage/upload-batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ folder: `questoes/${prova}`, files: files.map((f) => ({ contentType: typeOf(f), size: f.size })) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.items)) throw new Error(data.error || 'Falha ao preparar o envio.');
  return data.items;
}
/** envia direto ao armazenamento; tenta de novo se a rede falhar */
async function put(s: Signed, f: File) {
  for (let k = 0; ; k++) {
    const r = await fetch(s.uploadUrl, { method: 'PUT', headers: s.headers, body: f }).catch(() => null);
    if (r?.ok) return;
    if (k >= 2) throw new Error('Falha ao enviar a imagem.');
    await new Promise((res) => setTimeout(res, 800 * (k + 1)));
  }
}

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

    // 2) imagens: URLs pedidas em lotes, várias subindo ao mesmo tempo, encaixadas a cada 50
    const total = job.uploads.length;
    let sent = 0;
    let placed = 0;
    const pending = new Map<string, Record<string, string>>();
    // encaixe em fila por prova (questões da mesma prova não são gravadas ao mesmo tempo); provas diferentes em paralelo
    const chains = new Map<string, Promise<void>>();
    const flush = (prova: string, force = false) => {
      const batch = pending.get(prova);
      if (!batch || (!force && Object.keys(batch).length < BATCH)) return;
      pending.delete(prova);
      chains.set(
        prova,
        (chains.get(prova) ?? Promise.resolve()).then(async () => {
          const r = await attachPaperImages(prova, batch).catch(() => null);
          if (r) placed += Object.keys(batch).length;
          else log(`${prova}: não foi possível encaixar ${Object.keys(batch).length} imagens (envie de novo depois)`);
        }),
      );
    };
    // lotes de URLs (cada lote é de uma prova só)
    const chunks: (typeof job.uploads)[] = [];
    for (const u of job.uploads) {
      const last = chunks[chunks.length - 1];
      if (last && last.length < SIGN && last[0].prova === u.prova) last.push(u);
      else chunks.push([u]);
    }
    let ci = 0;
    const queue: { j: (typeof job.uploads)[number]; s: Signed }[] = [];
    let signing: Promise<void> | null = null;
    const refill = () =>
      (signing ??= (async () => {
        const c = chunks[ci++];
        try {
          const signed = await signMany(c[0].prova, c.map((j) => j.file));
          c.forEach((j, k) => {
            if (signed[k]?.uploadUrl) queue.push({ j, s: signed[k] });
            else {
              log(`Imagem ${j.name}: ${signed[k]?.error ?? 'falhou'}`);
              set({ done: ++sent });
            }
          });
        } catch (e) {
          c.forEach((j) => log(`Imagem ${j.name}: ${e instanceof Error ? e.message : 'falhou'}`));
          sent += c.length;
          set({ done: sent });
        }
      })().finally(() => (signing = null)));
    if (total) set({ label: 'Enviando imagens', done: 0, total });
    const worker = async () => {
      for (;;) {
        if (!queue.length) {
          if (signing) await signing;
          else if (ci < chunks.length) await refill();
          else return;
          continue;
        }
        // já pede o próximo lote enquanto este sobe
        if (queue.length < PARALLEL * 2 && ci < chunks.length && !signing) void refill();
        const { j, s } = queue.shift()!;
        try {
          await put(s, j.file);
          const b = pending.get(j.prova) ?? {};
          b[j.name] = s.publicUrl;
          pending.set(j.prova, b);
          flush(j.prova);
        } catch (e) {
          log(`Imagem ${j.name}: ${e instanceof Error ? e.message : 'falhou'}`);
        }
        set({ done: ++sent });
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    for (const prova of [...pending.keys()]) flush(prova, true);
    set({ label: 'Encaixando imagens' });
    await Promise.all(chains.values());

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
