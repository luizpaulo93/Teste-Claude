'use client';

import { CheckCircle2, FileJson, FolderOpen, ImageIcon, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Checkbox, ProgressBar } from '@/components/ui';
import { ActionButton, Spinner } from '@/components/ui-client';
import { fileName, imagesOf, type ProvaIn } from '@/lib/question-types';
import { cn } from '@/lib/utils';
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

  async function readJson(f: File) {
    try {
      const data = JSON.parse(await f.text());
      const list: ProvaIn[] = Array.isArray(data?.provas) ? data.provas : Array.isArray(data) ? data : data?.provaId ? [data] : [];
      if (!list.length || !list.every((p) => p?.provaId && Array.isArray(p.questoes))) throw new Error('formato');
      setProvas(list);
      setJsonName(f.name);
      clearImportResult();
      await refreshCheck(list);
    } catch {
      toast.error('Este arquivo não é um provas.json válido.');
    }
  }

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const all = Array.from(list);
    const json = all.find((f) => /\.json$/i.test(f.name));
    const imgs = all.filter(isImage);
    if (imgs.length) {
      setFiles((m) => {
        const n = new Map(m);
        for (const f of imgs) n.set(f.name, f);
        return n;
      });
      clearImportResult();
    }
    if (json) await readJson(json);
    else if (!check) await refreshCheck(provas);
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
                <span className="min-w-0 flex-1 font-semibold text-ink">
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
