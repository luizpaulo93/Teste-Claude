'use client';

import { AppWindow, Camera, CircleStop, Mic, MicOff, Monitor, MonitorOff, PictureInPicture2, Radio, Settings2, Video, Wifi } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmDialog } from '@/components/confirm';
import { toast } from '@/components/toast';
import { buttonClass, Select } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { Broadcaster, checkSupport, type BroadcastStatus } from '@/lib/live/broadcaster';
import { Compositor, type Corner, type Scene } from '@/lib/live/compositor';
import { cn } from '@/lib/utils';
import { startStudio, stopStudio } from '../../../live-actions';

const QUALITIES = {
  '480': { w: 854, h: 480, bitrate: 1_200_000, label: '480p (internet fraca)' },
  '720': { w: 1280, h: 720, bitrate: 2_500_000, label: '720p (recomendado)' },
  '1080': { w: 1920, h: 1080, bitrate: 4_500_000, label: '1080p (internet boa)' },
} as const;
type Quality = keyof typeof QUALITIES;

const SCENES: { key: Scene; label: string; icon: typeof Video }[] = [
  { key: 'camera', label: 'Só câmera', icon: Video },
  { key: 'screen', label: 'Só tela', icon: Monitor },
  { key: 'both', label: 'Tela + câmera', icon: PictureInPicture2 },
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
export function Studio({ liveId, live, ready, hint }: { liveId: string; live: boolean; ready: boolean; hint: string }) {
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
      camTrack.current?.stop();
      screenTrack.current?.stop();
      micStream.current?.getTracks().forEach((t) => t.stop());
      void audio.current?.ctx.close();
    };
  }, []);

  // Tamanho do quadro = qualidade escolhida
  useEffect(() => {
    const q = QUALITIES[quality];
    comp.current?.resize(q.w, q.h);
  }, [quality]);

  // Cena e canto da câmera
  useEffect(() => {
    if (comp.current) {
      comp.current.scene = scene;
      comp.current.corner = corner;
    }
  }, [scene, corner]);

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
      // Só o áudio vai pela trilha; o vídeo vem da mesa de cenas (quadro a quadro)
      const stream = new MediaStream([m.dest.stream.getAudioTracks()[0]]);
      const b = new Broadcaster({ liveId, stream, width: q.w, height: q.h, fps: 30, videoBitrate: q.bitrate, onStatus: setStatus });
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
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black">
          <canvas ref={canvasRef} width={1280} height={720} className="size-full object-contain" aria-label="Prévia da transmissão" />
          {onAir && (
            <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO · {clock(status?.seconds ?? 0)}
            </span>
          )}
          {status?.state === 'reconnecting' && <span className="absolute top-3 right-3 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-bold text-black">Reconectando…</span>}
        </div>

        {/* Cenas */}
        <div className="grid grid-cols-3 gap-2">
          {SCENES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={scene === s.key}
              onClick={() => pickScene(s.key)}
              disabled={s.key !== 'camera' && !canShare}
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
        {scene === 'both' && (
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
            <p className="text-xs text-muted">Espelhar a tela só funciona no computador (Chrome ou Edge).</p>
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
    </div>
  );
}
