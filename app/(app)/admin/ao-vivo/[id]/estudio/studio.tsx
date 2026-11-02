'use client';

import { AppWindow, Camera, ChevronLeft, ChevronRight, CircleStop, FileText, FlipHorizontal2, Mic, MicOff, Monitor, MonitorOff, PictureInPicture2, Radio, RotateCw, Settings2, Video, Wifi } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmDialog } from '@/components/confirm';
import { toast } from '@/components/toast';
import { buttonClass, Select } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { Broadcaster, checkSupport, type BroadcastStatus } from '@/lib/live/broadcaster';
import { Compositor, type Corner, type Fit, type Scene } from '@/lib/live/compositor';
import { PdfPresenter, type PdfView } from '@/lib/live/pdf-presenter';
import { getFileUrl } from '@/lib/storage/client';
import type { LessonMaterial } from '@/lib/types';
import { cn } from '@/lib/utils';
import { startStudio, stopStudio } from '../../../live-actions';

const QUALITIES = {
  '480': { w: 854, h: 480, bitrate: 1_200_000, label: '480p (internet fraca)' },
  '720': { w: 1280, h: 720, bitrate: 2_500_000, label: '720p (recomendado)' },
  '1080': { w: 1920, h: 1080, bitrate: 4_500_000, label: '1080p (internet boa)' },
} as const;
type Quality = keyof typeof QUALITIES;

const SCENES: { key: Scene; label: string; icon: typeof Video; desktop?: boolean }[] = [
  { key: 'camera', label: 'Câmera', icon: Video },
  { key: 'pdf', label: 'PDF + câmera', icon: FileText },
  { key: 'screen', label: 'Só tela', icon: Monitor, desktop: true },
  { key: 'both', label: 'Tela + câmera', icon: PictureInPicture2, desktop: true },
];
const CORNERS: { key: Corner; label: string }[] = [
  { key: 'tl', label: '↖' },
  { key: 'tr', label: '↗' },
  { key: 'bl', label: '↙' },
  { key: 'br', label: '↘' },
];

const clock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Estúdio: escolhe câmera, microfone e a tela (inteira ou uma janela), monta a cena e transmite direto
 * para o YouTube. Três cenas, como no OBS: só a câmera, só a tela, ou a tela com a câmera no canto.
 * Dá para trocar de cena no meio da live. O áudio passa por um mixer: trocar o microfone não corta o som.
 */
export function Studio({ liveId, live, ready, hint, materials = [] }: { liveId: string; live: boolean; ready: boolean; hint: string; materials?: LessonMaterial[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const comp = useRef<Compositor | null>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cam, setCam] = useState<string>(''); // deviceId ou 'none'
  const [mic, setMic] = useState<string>(''); // deviceId ou 'none'
  const [scene, setScene] = useState<Scene>('camera');
  const [corner, setCorner] = useState<Corner>('br');
  const [screenOn, setScreenOn] = useState(false);
  const [quality, setQuality] = useState<Quality>('720');
  // a live é sempre horizontal (16:9)
  const vertical = false;
  const [rotation, setRotation] = useState(0);
  const [mirror, setMirror] = useState(false);
  const [fit, setFit] = useState<Fit>('cover');
  const [pip, setPip] = useState(true);
  const pdf = useRef<PdfPresenter | null>(null);
  const [pdfId, setPdfId] = useState('');
  const [pdfView, setPdfView] = useState<PdfView | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastTap = useRef(0);
  const [pageInput, setPageInput] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [level, setLevel] = useState(0);
  const [support, setSupport] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [status, setStatus] = useState<BroadcastStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [permError, setPermError] = useState('');
  const [canShare, setCanShare] = useState(false);

  const camTrack = useRef<MediaStreamTrack | null>(null);
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const audio = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; analyser: AnalyserNode; src?: MediaStreamAudioSourceNode } | null>(null);
  const caster = useRef<Broadcaster | null>(null);
  const onAir = status?.state === 'live' || status?.state === 'starting' || status?.state === 'reconnecting';

  // Mixer de áudio (sempre existe uma trilha de áudio, mesmo sem microfone)
  const mixer = useCallback(() => {
    if (!audio.current) {
      const ctx = new AudioContext({ sampleRate: 48000 });
      const dest = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      audio.current = { ctx, dest, analyser };
    }
    return audio.current;
  }, []);

  // Mesa de cenas + permissão + lista de dispositivos
  useEffect(() => {
    if (canvasRef.current) comp.current = new Compositor(canvasRef.current, 30);
    pdf.current = new PdfPresenter();
    pdf.current.onChange = () => setPdfView(pdf.current!.view);
    if (comp.current) comp.current.pdf = pdf.current;
    void checkSupport().then(setSupport);
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {
        setPermError('Libere o acesso à câmera e ao microfone no navegador para usar o estúdio.');
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      const c = list.filter((d) => d.kind === 'videoinput');
      const m = list.filter((d) => d.kind === 'audioinput');
      setCams(c);
      setMics(m);
      setCanShare('getDisplayMedia' in navigator.mediaDevices);
      setCam((v) => v || c[0]?.deviceId || 'none');
      setMic((v) => v || m[0]?.deviceId || 'none');
    })();
    return () => {
      comp.current?.destroy();
      pdf.current?.destroy();
      camTrack.current?.stop();
      screenTrack.current?.stop();
      micStream.current?.getTracks().forEach((t) => t.stop());
      void audio.current?.ctx.close();
    };
  }, []);

  // Tamanho do quadro = qualidade e formato (horizontal 16:9 ou vertical 9:16)
  const dims = () => {
    const q = QUALITIES[quality];
    return vertical ? { w: q.h, h: q.w } : { w: q.w, h: q.h };
  };
  useEffect(() => {
    const d = dims();
    comp.current?.resize(d.w, d.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, vertical]);

  // Cena, canto, giro, espelho e encaixe da câmera
  useEffect(() => {
    const c = comp.current;
    if (!c) return;
    c.scene = scene;
    c.corner = corner;
    c.rotation = rotation;
    c.mirror = mirror;
    c.fit = fit;
    c.pip = pip;
  }, [scene, corner, rotation, mirror, fit, pip]);

  // Tela ligada durante a live (o celular não apaga a tela no meio da aula)
  useEffect(() => {
    if (!onAir || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const get = () =>
      (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    void get();
    const again = () => document.visibilityState === 'visible' && void get();
    document.addEventListener('visibilitychange', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      void lock?.release();
    };
  }, [onAir]);

  /** Abre um PDF da live no Estúdio */
  async function openPdf(id: string) {
    const m = materials.find((x) => x.id === id);
    setPdfId(id);
    if (!m || !pdf.current) return;
    setPdfBusy(true);
    try {
      const url = await getFileUrl(m.file_path);
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      await pdf.current.load(await res.arrayBuffer());
      setPdfView(pdf.current.view);
      setScene('pdf');
    } catch {
      toast.error('Não foi possível abrir este PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  // Na tela da transmissão: um dedo move o PDF, dois dedos dão zoom (pinça), dois toques alternam largura/página
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (scene !== 'pdf') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) pdf.current?.toggleFit();
      lastTap.current = now;
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    if (!prev || scene !== 'pdf' || !pdf.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (ps.size === 1) {
      pdf.current.pan((e.clientX - prev.x) / r.width, (e.clientY - prev.y) / r.height, true);
    } else if (ps.size === 2) {
      const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const mx = ((e.clientX + other.x) / 2 - r.left) / r.width;
      const my = ((e.clientY + other.y) / 2 - r.top) / r.height;
      if (d0 > 0) pdf.current.zoomAt(d1 / d0, mx, my);
      // arrastar com os dois dedos também move
      pdf.current.pan((e.clientX - prev.x) / 2 / r.width, (e.clientY - prev.y) / 2 / r.height);
    }
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
  };

  // Rolagem (mouse/trackpad): rola o PDF e passa de página no fim; Ctrl + rolagem (ou pinça no trackpad) dá zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (scene !== 'pdf' || !pdf.current?.pages) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey) pdf.current.zoomAt(Math.exp(-e.deltaY / 300), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      else pdf.current.pan(-e.deltaX / r.width, -e.deltaY / r.height, true);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [scene]);

  useEffect(() => {
    if (pdfView) setPageInput(String(pdfView.page));
  }, [pdfView?.page]);

  // Câmera escolhida
  useEffect(() => {
    if (!cam) return;
    if (cam === 'none') {
      comp.current?.setCamera(null);
      camTrack.current?.stop();
      camTrack.current = null;
      return;
    }
    let cancelled = false;
    const q = QUALITIES[quality];
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: cam }, width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: 30 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        const t = s.getVideoTracks()[0];
        const old = camTrack.current;
        camTrack.current = t;
        comp.current?.setCamera(t);
        if (old && old !== t) old.stop();
      })
      .catch(() => toast.error('Não foi possível abrir esta câmera.'));
    return () => {
      cancelled = true;
    };
  }, [cam, quality]);

  /** Espelhar a tela inteira ou uma janela (o navegador mostra a lista para escolher). */
  async function shareScreen(surface: 'monitor' | 'window') {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, displaySurface: surface } as MediaTrackConstraints,
        audio: false,
      });
      const t = s.getVideoTracks()[0];
      t.addEventListener('ended', () => {
        if (screenTrack.current !== t) return;
        screenTrack.current = null;
        comp.current?.setScreen(null);
        setScreenOn(false);
        setScene('camera');
        toast('Espelhamento encerrado: voltou para a câmera.');
      });
      const old = screenTrack.current;
      screenTrack.current = t;
      comp.current?.setScreen(t);
      old?.stop();
      setScreenOn(true);
      setScene((sc) => (sc === 'camera' ? (camTrack.current ? 'both' : 'screen') : sc));
    } catch {
      /* cancelou a escolha */
    }
  }

  function stopScreen() {
    screenTrack.current?.stop();
    screenTrack.current = null;
    comp.current?.setScreen(null);
    setScreenOn(false);
    setScene('camera');
  }

  function pickScene(s: Scene) {
    if (s === 'pdf') {
      setScene('pdf');
      if (!materials.length) toast('Suba um PDF em "PDFs da live" (abaixo) para mostrar aqui.');
      // já tem PDF aberto: volta para ele. Senão: mais de um pergunta qual abrir; só um abre direto
      else if (pdfView?.pages) return;
      else if (materials.length > 1) setChoosing(true);
      else void openPdf(materials[0].id);
      return;
    }
    if (s !== 'camera' && !screenTrack.current) {
      setScene(s);
      void shareScreen('monitor');
      return;
    }
    if (s !== 'screen' && !camTrack.current) toast('Escolha uma câmera para esta cena.');
    setScene(s);
  }

  // Microfone → mixer
  useEffect(() => {
    if (!mic) return;
    const m = mixer();
    m.src?.disconnect();
    micStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current = null;
    if (mic === 'none') return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: { exact: mic }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        micStream.current = s;
        const src = m.ctx.createMediaStreamSource(s);
        src.connect(m.dest);
        src.connect(m.analyser);
        m.src = src;
      })
      .catch(() => toast.error('Não foi possível abrir este microfone.'));
    return () => {
      cancelled = true;
    };
  }, [mic, mixer]);

  // Medidor do microfone
  useEffect(() => {
    let raf = 0;
    const buf = new Uint8Array(256);
    const loop = () => {
      const a = audio.current?.analyser;
      if (a) {
        a.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 90));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Avisa antes de fechar a página no meio da live
  useEffect(() => {
    if (!onAir) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [onAir]);

  async function goLive() {
    if (!camTrack.current && !screenTrack.current) return toast.error('Escolha a câmera ou espelhe a tela.');
    setBusy(true);
    try {
      const r = await startStudio(liveId);
      if (r.error) return void toast.error(r.error);
      const m = mixer();
      await m.ctx.resume();
      const q = QUALITIES[quality];
      const d = dims();
      // Só o áudio vai pela trilha; o vídeo vem da mesa de cenas (quadro a quadro)
      const stream = new MediaStream([m.dest.stream.getAudioTracks()[0]]);
      const b = new Broadcaster({ liveId, stream, width: d.w, height: d.h, fps: 30, videoBitrate: q.bitrate, onStatus: setStatus });
      caster.current = b;
      await b.start();
      if (comp.current) comp.current.onFrame = (c) => b.pushFrame(c);
      toast('Transmissão iniciada');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function endLive() {
    if (!(await confirmDialog('Encerrar a transmissão?'))) return;
    setBusy(true);
    try {
      if (comp.current) comp.current.onFrame = undefined;
      await caster.current?.stop();
      caster.current = null;
      const r = await stopStudio(liveId);
      if (r.error) toast.error(r.error);
      else toast('Transmissão encerrada');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const blocked = !support?.ok || !ready;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <div className={cn('relative mx-auto overflow-hidden rounded-2xl border border-line bg-black', vertical ? 'aspect-[9/16] max-h-[70dvh]' : 'aspect-video w-full')}>
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className={cn('size-full object-contain', scene === 'pdf' && 'cursor-grab touch-none active:cursor-grabbing')}
            aria-label="Prévia da transmissão"
          />
          {onAir && (
            <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO · {clock(status?.seconds ?? 0)}
            </span>
          )}
          {scene === 'pdf' && materials.length > 1 && (
            <button
              type="button"
              onClick={() => setChoosing(true)}
              aria-label="Trocar de PDF"
              title="Trocar de PDF"
              className={cn('absolute right-2 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-black/75', status?.state === 'reconnecting' ? 'top-10' : 'top-2')}
            >
              <FileText className="size-3.5" /> Trocar
            </button>
          )}
          {status?.state === 'reconnecting' && <span className="absolute top-3 right-3 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-bold text-black">Reconectando…</span>}
        </div>

        {/* Cenas */}
        <div className={cn('grid gap-2', canShare ? 'grid-cols-4' : 'grid-cols-2')}>
          {SCENES.filter((s) => canShare || !s.desktop).map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={scene === s.key}
              onClick={() => pickScene(s.key)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition disabled:opacity-40',
                scene === s.key ? 'border-red-500 bg-red-500/10 text-ink' : 'border-line text-ink-2 hover:bg-surface-2',
              )}
            >
              <s.icon className={cn('size-5', scene === s.key ? 'text-red-500' : 'text-muted')} />
              {s.label}
            </button>
          ))}
        </div>
        {/* PDF na live */}
        {scene === 'pdf' && (
          <div className="space-y-2 rounded-2xl border border-line bg-surface p-3">
            {materials.length ? (
              <Select value={pdfId} onChange={(e) => void openPdf(e.target.value)} aria-label="PDF para mostrar" className={materials.length > 1 ? 'hidden' : ''}>
                <option value="" disabled>
                  Escolha o PDF
                </option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-xs text-muted">Suba o PDF em “PDFs da live”, logo abaixo. Ele aparece aqui para você mostrar.</p>
            )}
            {pdfBusy && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Spinner /> Abrindo o PDF…
              </p>
            )}
            {pdfView && pdfView.pages > 0 && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => void pdf.current?.goTo(pdfView.page - 1)} disabled={pdfView.page <= 1} aria-label="Página anterior" className={buttonClass('secondary', 'icon', 'size-11')}>
                    <ChevronLeft className="size-5" />
                  </button>
                  <form
                    className="flex items-center gap-1.5 text-sm font-semibold text-ink"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = parseInt(pageInput, 10);
                      if (n) void pdf.current?.goTo(n);
                      (document.activeElement as HTMLElement | null)?.blur();
                    }}
                  >
                    Página
                    <input
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      onBlur={() => {
                        const n = parseInt(pageInput, 10);
                        if (n && n !== pdfView.page) void pdf.current?.goTo(n);
                        else setPageInput(String(pdfView.page));
                      }}
                      inputMode="numeric"
                      aria-label="Ir para a página"
                      className="h-9 w-14 rounded-lg border border-line-strong bg-bg-elev text-center tabular-nums"
                    />
                    <span className="tabular-nums">de {pdfView.pages}</span>
                  </form>
                  <button type="button" onClick={() => void pdf.current?.goTo(pdfView.page + 1)} disabled={pdfView.page >= pdfView.pages} aria-label="Próxima página" className={buttonClass('secondary', 'icon', 'size-11')}>
                    <ChevronRight className="size-5" />
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  <input type="checkbox" checked={pip} onChange={(e) => setPip(e.target.checked)} className="size-4 accent-[#3b82f6]" /> Minha câmera no canto
                </label>
                <p className="text-[11px] text-muted">
                  Na tela da transmissão: <strong>um dedo</strong> move, <strong>dois dedos</strong> dão zoom, <strong>dois toques</strong> alternam entre a largura e a página inteira. Rolando até o fim, passa de página.
                </p>
              </>
            )}
          </div>
        )}

        {(scene === 'both' || (scene === 'pdf' && pip)) && (
          <div className="flex items-center gap-2 text-xs text-ink-2">
            Câmera no canto:
            {CORNERS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={`Canto ${c.label}`}
                aria-pressed={corner === c.key}
                onClick={() => setCorner(c.key)}
                className={cn('grid size-8 place-items-center rounded-lg border text-sm', corner === c.key ? 'border-brand bg-brand text-white' : 'border-line')}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Microfone */}
        <div className="flex items-center gap-2">
          {mic === 'none' ? <MicOff className="size-4 text-muted" /> : <Mic className="size-4 text-brand" />}
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div className={cn('h-full rounded-full transition-[width] duration-75', level > 0.85 ? 'bg-danger' : 'bg-success')} style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        </div>
        {onAir || status?.state === 'stopped' ? (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="text-muted">Tempo</p>
              <p className="font-bold text-ink tabular-nums">{clock(status?.seconds ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="text-muted">Envio</p>
              <p className="font-bold text-ink tabular-nums">{status?.kbps ?? 0} kbps</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="flex items-center justify-center gap-1 text-muted">
                <Wifi className="size-3" /> Fila
              </p>
              <p className={cn('font-bold tabular-nums', (status?.queue ?? 0) > 2 ? 'text-warning' : 'text-ink')}>{status?.queue ?? 0}</p>
            </div>
          </div>
        ) : null}
        {status?.state === 'error' && <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{status.message}</p>}
      </div>

      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Camera className="size-3.5" /> Câmera
          </span>
          <Select value={cam} onChange={(e) => setCam(e.target.value)} aria-label="Câmera">
            {cams.map((c, i) => (
              <option key={c.deviceId || i} value={c.deviceId}>
                {c.label || `Câmera ${i + 1}`}
              </option>
            ))}
            <option value="none">Sem câmera</option>
          </Select>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} className={buttonClass('secondary', 'sm', 'px-1 text-[11px]')} aria-label="Girar câmera">
            <RotateCw className="size-4" /> Girar{rotation ? ` ${rotation}°` : ''}
          </button>
          <button type="button" onClick={() => setMirror((m) => !m)} aria-pressed={mirror} className={buttonClass(mirror ? 'primary' : 'secondary', 'sm', 'px-1 text-[11px]')} aria-label="Espelhar câmera">
            <FlipHorizontal2 className="size-4" /> Espelhar
          </button>
          <button type="button" onClick={() => setFit((f) => (f === 'cover' ? 'contain' : 'cover'))} className={buttonClass('secondary', 'sm', 'px-1 text-[11px]')} aria-label="Encaixe da câmera">
            {fit === 'cover' ? 'Preencher' : 'Inteira'}
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Monitor className="size-3.5" /> Espelhar tela
          </span>
          {canShare ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => shareScreen('monitor')} className={buttonClass('secondary', 'sm')}>
                <Monitor className="size-4" /> Tela inteira
              </button>
              <button type="button" onClick={() => shareScreen('window')} className={buttonClass('secondary', 'sm')}>
                <AppWindow className="size-4" /> Uma janela
              </button>
              {screenOn && (
                <button type="button" onClick={stopScreen} className={buttonClass('ghost', 'sm', 'col-span-2 text-danger')}>
                  <MonitorOff className="size-4" /> Parar de espelhar
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted">
              No celular e no tablet, mostre o PDF pela cena <strong>PDF + câmera</strong>. Não saia do navegador durante a live: o aparelho pausa a transmissão.
            </p>
          )}
          {screenOn && <p className="text-[11px] text-success">Tela espelhada. Pode trocar de janela: a live continua.</p>}
        </div>

        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Mic className="size-3.5" /> Microfone
          </span>
          <Select value={mic} onChange={(e) => setMic(e.target.value)} aria-label="Microfone">
            {mics.map((m, i) => (
              <option key={m.deviceId || i} value={m.deviceId}>
                {m.label || `Microfone ${i + 1}`}
              </option>
            ))}
            <option value="none">Sem microfone</option>
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Settings2 className="size-3.5" /> Qualidade
          </span>
          <Select value={quality} onChange={(e) => setQuality(e.target.value as Quality)} disabled={onAir}>
            {(Object.keys(QUALITIES) as Quality[]).map((k) => (
              <option key={k} value={k}>
                {QUALITIES[k].label}
              </option>
            ))}
          </Select>
        </label>

        {onAir ? (
          <button type="button" onClick={endLive} disabled={busy} className={buttonClass('secondary', 'lg', 'w-full')}>
            {busy ? <Spinner /> : <CircleStop className="size-4" />} Encerrar transmissão
          </button>
        ) : (
          <button type="button" onClick={goLive} disabled={busy || blocked} className={buttonClass('primary', 'lg', 'w-full !bg-red-600 hover:!bg-red-700')}>
            {busy ? <Spinner /> : <Radio className="size-4" />} {live ? 'Transmitir (sala já está no ar)' : 'Iniciar transmissão'}
          </button>
        )}
        <p className="text-xs text-muted">{support && !support.ok ? support.reason : permError || hint}</p>
      </div>
      <Modal open={choosing} onClose={() => setChoosing(false)} title="Qual PDF mostrar?" size="sm">
        <ul className="space-y-1.5">
          {materials.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setChoosing(false);
                  void openPdf(m.id);
                }}
                className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-surface-2', pdfId === m.id ? 'border-brand bg-brand/10' : 'border-line')}
              >
                <FileText className="size-5 shrink-0 text-danger" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.title}</span>
                {pdfId === m.id && <span className="text-[11px] text-brand">aberto</span>}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
