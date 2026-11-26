'use client';

import { CheckCircle2, FileArchive, FileJson, FolderOpen, ImageIcon, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Checkbox, ProgressBar } from '@/components/ui';
import { ActionButton, Spinner } from '@/components/ui-client';
import { fileName, imagesOf, type ProvaIn } from '@/lib/question-types';
import { cn } from '@/lib/utils';
import { filesFromZip } from '@/lib/unzip-client';
import { checkImport, deletePaper } from './actions';
import { clearImportResult, startImport, useImportJob } from './import-job';

type Check = Awaited<ReturnType<typeof checkImport>>;
const RES_KEYS = ['resolucao', 'resolução', 'solucao', 'solução', 'comentario', 'comentário', 'explicacao', 'explicação', 'gabaritoComentado'];
/** questões da prova sem texto de resolução */
const noRes = (p: ProvaIn) =>
  p.questoes.filter((q) => !q.resolucaoBlocos?.length && !RES_KEYS.some((k) => {
    const v = (q as unknown as Record<string, unknown>)[k];
    return (typeof v === 'string' && v.trim()) || (v && typeof v === 'object' && typeof (v as { texto?: unknown }).texto === 'string');
  })).length;
/** zip pelo começo do arquivo ("PK\x03\x04"), mesmo sem extensão no nome */
const looksZip = async (f: File) => {
  const b = new Uint8Array(await f.slice(0, 4).arrayBuffer());
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
};
const looksJson = async (f: File) => /^\s*[[{]/.test(await f.slice(0, 64).text());
const isImage = (f: File) => /\.(webp|png|jpe?g|gif|avif)$/i.test(f.name) || f.type.startsWith('image/');

/**
 * Importar provas: o provas.json + as imagens (todas de uma vez, ou a pasta inteira no computador).
 * Cada imagem vai para o lugar certo pelo nome do arquivo (ex.: brasil_q107_altA.webp → alternativa A da 107).
 * Dá para mandar só as imagens depois: elas se encaixam nas provas já importadas.
 */
export function Importer() {
  const jsonInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const [unzipping, setUnzipping] = useState('');
  const [provas, setProvas] = useState<ProvaIn[] | null>(null);
  const [jsonName, setJsonName] = useState('');
  const [files, setFiles] = useState<Map<string, File>>(new Map());
  const [check, setCheck] = useState<Check | null>(null);
  const [allowMissing, setAllowMissing] = useState(false);
  /** imagens que o app já tem: só reenvia se pedir (ex.: versão nova da figura) */
  const [replace, setReplace] = useState(false);
  // a importação roda fora desta tela: continua mesmo navegando pelo app
  const job = useImportJob();
  const busy = job.running;
  const progress = job.running ? { done: job.done, total: job.total, label: job.label } : null;
  const log = job.log;
  const done = job.running ? null : job.result;
  // terminou: limpa a escolha e atualiza o que o app já tem
  const seen = useRef(job.finished);
  useEffect(() => {
    if (job.finished === seen.current) return;
    seen.current = job.finished;
    setProvas(null);
    setFiles(new Map());
    setAllowMissing(false);
    setReplace(false);
    setJsonName('');
    void refreshCheck(null);
  }, [job.finished]);

  async function refreshCheck(list: ProvaIn[] | null) {
    setCheck(await checkImport((list ?? []).map((p) => p.provaId)).catch(() => null));
  }

  /** Lê um ou vários .json de provas (vários juntos viram uma importação só; prova repetida fica a última). */
  async function readJson(fs: File[], quiet = false) {
    const byId = new Map<string, ProvaIn>();
    const ok: string[] = [];
    for (const f of fs) {
      try {
        const data = JSON.parse(await f.text());
        const list: ProvaIn[] = Array.isArray(data?.provas) ? data.provas : Array.isArray(data) ? data : data?.provaId ? [data] : [];
        if (!list.length || !list.every((p) => p?.provaId && Array.isArray(p.questoes))) throw new Error('formato');
        for (const p of list) byId.set(p.provaId, p);
        ok.push(f.name);
      } catch {
        if (!quiet) toast.error(`${f.name} não é um provas.json válido.`);
      }
    }
    if (!byId.size) {
      if (quiet) toast.error('Não achei nenhum provas.json válido dentro do zip.');
      return;
    }
    const list = [...byId.values()];
    setProvas(list);
    setJsonName(ok.length === 1 ? ok[0] : `${ok.length} arquivos .json`);
    clearImportResult();
    await refreshCheck(list);
  }

  async function pick(input: FileList | File[] | null) {
    if (!input?.length) return;
    let all = Array.from(input);
    // .zip: abre aqui mesmo e separa o provas.json e as imagens, de qualquer pasta de dentro
    // no Android o arquivo pode chegar sem a extensão: o zip é reconhecido pelo conteúdo (começa com "PK")
    const zipFlags = await Promise.all(all.map(async (f) => /\.zip$/i.test(f.name) || /zip/i.test(f.type) || (!isImage(f) && (await looksZip(f)))));
    const zips = all.filter((_, i) => zipFlags[i]);
    if (zips.length) {
      all = all.filter((f) => !zips.includes(f));
      for (const z of zips) {
        setUnzipping(z.name);
        try {
          all.push(...(await filesFromZip(z)));
        } catch {
          toast.error(`Não consegui abrir ${z.name}. Confira se é um .zip.`);
        }
      }
      setUnzipping('');
    }
    // .json pelo nome ou, sem extensão, pelo conteúdo (texto que começa com { ou [)
    const jsonFlags = await Promise.all(all.map(async (f) => /\.json$/i.test(f.name) || (!isImage(f) && !/\.[a-z0-9]{2,5}$/i.test(f.name) && (await looksJson(f)))));
    const jsons = all.filter((_, i) => jsonFlags[i]);
    const json = jsons[0];
    const imgs = all.filter(isImage);
    if (imgs.length) {
      setFiles((m) => {
        const n = new Map(m);
        for (const f of imgs) n.set(f.name, f);
        return n;
      });
      clearImportResult();
    }
    if (json) await readJson(jsons, zips.length > 0 || jsons.length > 1);
    else if (!check) await refreshCheck(provas);
    if (zips.length) toast(`Zip aberto: ${jsons.length} arquivo(s) .json e ${imgs.length} imagens.`);
  }

  // ---------------- resumo
  const cited = new Map<string, Set<string>>(); // prova → nomes de arquivo citados
  for (const p of provas ?? []) cited.set(p.provaId, new Set(p.questoes.flatMap((q) => imagesOf(q).map((i) => fileName(i.arquivo)))));
  const haveIn = (prova: string, n: string) => Boolean(check?.have[prova]?.[n]);
  let citedN = 0;
  let foundN = 0;
  let inAppN = 0;
  let sameN = 0;
  const missing: string[] = [];
  for (const [prova, names] of cited)
    for (const n of names) {
      citedN++;
      if (haveIn(prova, n) && files.has(n)) sameN++;
      if (files.has(n) && (replace || !haveIn(prova, n)))
        foundN++; // escolhida agora (e ainda não está no app, ou vai substituir)
      else if (haveIn(prova, n)) inAppN++;
      else missing.push(n);
    }
  // só imagens: encaixam em provas que já estão no app e esperam por elas
  // (só as que ainda faltam: escolher a pasta de novo depois de uma parada envia só o resto)
  // (só imagens que já estão no app, nenhuma faltando: é versão nova da figura, substitui)
  const fits = new Map<string, string[]>();
  let sameOnly = 0;
  let missingChosen = 0;
  if (!provas && check) {
    const provs = [...new Set([...Object.keys(check.want), ...Object.keys(check.have)])];
    for (const prova of provs) {
      sameOnly += Object.keys(check.have[prova] ?? {}).filter((n) => files.has(n)).length;
      missingChosen += (check.want[prova] ?? []).filter((n) => files.has(n)).length;
    }
    const swap = replace || missingChosen === 0;
    for (const prova of provs) {
      const inApp = Object.keys(check.have[prova] ?? {}).filter((n) => files.has(n));
      const got = [...(check.want[prova] ?? []), ...(swap ? inApp : [])].filter((n) => files.has(n));
      if (got.length) fits.set(prova, [...new Set(got)]);
    }
  }
  const fitsN = [...fits.values()].reduce((a, l) => a + l.length, 0);
  const used = new Set(
    [...cited.values()]
      .flatMap((s) => [...s])
      .concat([...fits.values()].flat())
      .concat(check ? Object.values(check.have).flatMap((m) => Object.keys(m)) : []),
  );
  const unused = [...files.keys()].filter((n) => !used.has(n));
  const canImport = provas ? !missing.length || allowMissing : fitsN > 0;

  function run() {
    if (provas) {
      const uploads = [...cited].flatMap(([prova, names]) =>
        [...names].filter((n) => files.has(n) && (replace || !haveIn(prova, n))).map((name) => ({ prova, name, file: files.get(name)! })),
      );
      void startImport({ provas: provas.map((p) => ({ prova: p, have: check?.have[p.provaId] ?? {} })), uploads });
    } else {
      const uploads = [...fits].flatMap(([prova, names]) => names.map((name) => ({ prova, name, file: files.get(name)! })));
      void startImport({ provas: [], uploads });
    }
    toast('Importando… pode continuar usando o app');
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <button
        type="button"
        onClick={() => zipInput.current?.click()}
        disabled={Boolean(unzipping) || busy}
        className="flex w-full items-center gap-3 rounded-xl border border-brand/40 bg-brand-soft p-3.5 text-left transition hover:border-brand disabled:opacity-60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-white">
          {unzipping ? <Spinner /> : <FileArchive className="size-5" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{unzipping ? `Abrindo ${unzipping}…` : 'Arquivo .zip (tudo junto)'}</span>
          <span className="block text-xs text-muted">O provas.json e as imagens são lidos e organizados sozinhos.</span>
        </span>
      </button>
      <input
        ref={zipInput}
        type="file"
        // sem filtro de tipo: no Android o filtro abre só a galeria de fotos e esconde o .zip
        multiple
        hidden
        aria-label="Arquivo zip"
        onChange={(e) => void pick(e.target.files).then(() => (e.target.value = ''))}
      />
      <p className="text-center font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase">ou escolha separado</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <PickButton
          icon={<FileJson className="size-4" />}
          label={jsonName || 'Arquivo provas.json'}
          active={Boolean(provas)}
          onClick={() => jsonInput.current?.click()}
        />
        <PickButton
          icon={<ImageIcon className="size-4" />}
          label={files.size ? `${files.size} imagens escolhidas` : 'Imagens (todas de uma vez)'}
          active={files.size > 0}
          onClick={() => imgInput.current?.click()}
        />
        <PickButton icon={<FolderOpen className="size-4" />} label="Pasta inteira (computador)" onClick={() => dirInput.current?.click()} />
      </div>
      <input ref={jsonInput} type="file" accept=".json,application/json" hidden onChange={(e) => void pick(e.target.files).then(() => (e.target.value = ''))} />
      <input
        ref={imgInput}
        type="file"
        accept="image/webp,image/*,.webp"
        multiple
        hidden
        aria-label="Imagens das questões"
        onChange={(e) => void pick(e.target.files).then(() => (e.target.value = ''))}
      />
      <input
        ref={dirInput}
        type="file"
        multiple
        hidden
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => void pick(e.target.files).then(() => (e.target.value = ''))}
      />

      {provas && (
        <div className="space-y-2">
          {provas.map((p) => {
            const st = (s: string) => p.questoes.filter((q) => (q.status ?? 'valida') === s).length;
            return (
              <div key={p.provaId} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3 text-sm">
                <span className="min-w-0 basis-full font-semibold text-ink sm:flex-1 sm:basis-auto">
                  {[p.exame, p.ano, p.dia].filter(Boolean).join(' ')} · {p.aplicacao || p.provaId}
                </span>
                <Badge>{p.questoes.length} questões</Badge>
                {st('anulada') > 0 && <Badge tone="danger">{st('anulada')} anulada(s)</Badge>}
                {noRes(p) > 0 && <Badge tone="warning">{noRes(p) === p.questoes.length ? 'sem resolução' : `${noRes(p)} sem resolução`}</Badge>}
                {st('abandonado_na_calibracao') > 0 && <Badge tone="warning">{st('abandonado_na_calibracao')} sem TRI</Badge>}
                {check?.existing.includes(p.provaId) && <Badge tone="brand">já no app: será atualizada</Badge>}
              </div>
            );
          })}
        </div>
      )}

      {(provas || files.size > 0) && (
        <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
          {provas ? (
            <>
              <Num label="Imagens citadas" value={citedN} />
              <Num label="Escolhidas agora" value={foundN} tone={foundN ? 'ok' : undefined} />
              <Num label="Já no app" value={inAppN} />
              <Num label="Faltando" value={missing.length} tone={missing.length ? 'bad' : 'ok'} />
            </>
          ) : (
            <>
              <Num label="Imagens escolhidas" value={files.size} />
              <Num label="Têm lugar no app" value={fitsN} tone={fitsN ? 'ok' : 'bad'} />
              <Num label="Provas" value={fits.size} />
              <Num label="Sem lugar" value={unused.length} />
            </>
          )}
        </div>
      )}

      {(provas ? sameN : missingChosen ? sameOnly : 0) > 0 && (
        <Checkbox
          label={`Substituir as ${provas ? sameN : sameOnly} imagens que já estão no app`}
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
        />
      )}

      {provas && missing.length > 0 && (
        <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/8 p-3 text-xs text-ink-2">
          <p>
            Faltam {missing.length} imagens: {missing.slice(0, 6).join(', ')}
            {missing.length > 6 ? '…' : ''}
          </p>
          <Checkbox
            label="Importar mesmo assim (as imagens podem ser enviadas depois)"
            checked={allowMissing}
            onChange={(e) => setAllowMissing(e.target.checked)}
          />
        </div>
      )}
      {!provas && files.size > 0 && check && !fitsN && (
        <p className="text-xs text-warning">Nenhuma dessas imagens é esperada pelas provas do app. Escolha também o provas.json.</p>
      )}

      {progress && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted">
            {progress.label} · {progress.done}/{progress.total}
          </p>
          <p className="text-[11px] text-muted">Pode usar outras telas do app; não feche a aba.</p>
          <ProgressBar value={progress.total ? (progress.done / progress.total) * 100 : 0} />
        </div>
      )}
      {done && (
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="size-4" /> {done}
        </p>
      )}
      {log.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-surface-2 p-3 text-[11px] text-danger">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}

      {(provas || files.size > 0) && (
        <Button onClick={run} disabled={busy || !canImport} className="w-full">
          {busy ? <Spinner /> : <Upload className="size-4" />}
          {provas ? (check?.existing.length ? 'Importar e atualizar' : 'Importar') : 'Encaixar imagens'}
        </Button>
      )}
    </Card>
  );
}

function PickButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition',
        active ? 'border-brand bg-brand/8 text-brand' : 'border-dashed border-line-strong text-ink-2 hover:bg-surface-2',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Num({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'bad' }) {
  return (
    <div className="rounded-xl border border-line p-2.5">
      <p className="text-muted">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', tone === 'ok' ? 'text-success' : tone === 'bad' ? 'text-warning' : 'text-ink')}>{value}</p>
    </div>
  );
}

export function DeletePaper({ id }: { id: string }) {
  return (
    <ActionButton
      action={() => deletePaper(id)}
      confirm="Excluir esta prova? As questões e as respostas dos alunos nelas saem do app."
      success="Prova excluída"
      variant="ghost"
      size="sm"
      className="size-8 shrink-0 px-0 hover:text-danger"
      title="Excluir prova"
    >
      <Trash2 className="size-3.5" />
    </ActionButton>
  );
}
