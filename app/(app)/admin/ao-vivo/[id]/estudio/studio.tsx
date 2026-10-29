'use client';

import { Camera, CircleStop, Mic, MicOff, MonitorUp, Radio, Settings2, Wifi } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmDialog } from '@/components/confirm';
import { toast } from '@/components/toast';
import { buttonClass, Select } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { Broadcaster, checkSupport, type BroadcastStatus } from '@/lib/live/broadcaster';
import { cn } from '@/lib/utils';
import { startStudio, stopStudio } from '../../../live-actions';

const QUALITIES = {
  '480': { w: 854, h: 480, bitrate: 1_200_000, label: '480p (internet fraca)' },
  '720': { w: 1280, h: 720, bitrate: 2_500_000, label: '720p (recomendado)' },
  '1080': { w: 1920, h: 1080, bitrate: 4_500_000, label: '1080p (internet boa)' },
} as const;
type Quality = keyof typeof QUALITIES;

const clock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Estúdio: escolhe câmera (ou tela) e microfone, mostra a prévia e transmite direto para o YouTube.
 * O áudio passa por um mixer (AudioContext): trocar o microfone no meio da live não corta o som.
 */
export function Studio({ liveId, live, ready, hint }: { liveId: string; live: boolean; ready: boolean; hint: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [source, setSource] = useState<string>(''); // deviceId da câmera ou 'screen'
  const [mic, setMic] = useState<string>(''); // deviceId ou 'none'
  const [quality, setQuality] = useState<Quality>('720');
  const [level, setLevel] = useState(0);
  const [support, setSupport] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [status, setStatus] = useState<BroadcastStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [permError, setPermError] = useState('');
  const [canShare, setCanShare] = useState(false);

  const videoTrack = useRef<MediaStreamTrack | null>(null);
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

  // Permissão + lista de dispositivos
  useEffect(() => {
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
      const share = 'getDisplayMedia' in navigator.mediaDevices;
      setCanShare(share);
      setSource((v) => v || c[0]?.deviceId || (share ? 'screen' : ''));
      setMic((v) => v || m[0]?.deviceId || 'none');
    })();
    return () => {
      videoTrack.current?.stop();
      micStream.current?.getTracks().forEach((t) => t.stop());
      void audio.current?.ctx.close();
    };
  }, []);

  // Fonte de vídeo
  useEffect(() => {
    if (!source || source === 'screen') return;
    let cancelled = false;
    const q = QUALITIES[quality];
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: source }, width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: 30 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        applyVideo(s.getVideoTracks()[0]);
      })
      .catch(() => toast.error('Não foi possível abrir esta câmera.'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, quality]);

  function applyVideo(track: MediaStreamTrack) {
    const old = videoTrack.current;
    videoTrack.current = track;
    if (videoRef.current) videoRef.current.srcObject = new MediaStream([track]);
    caster.current?.setVideoTrack(track);
    if (old && old !== track) old.stop();
  }

  async function shareScreen() {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const t = s.getVideoTracks()[0];
      t.addEventListener('ended', () => setSource(cams[0]?.deviceId ?? ''));
      applyVideo(t);
    } catch {
      setSource(cams[0]?.deviceId ?? '');
    }
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
    if (!videoTrack.current) return toast.error('Escolha a câmera ou a tela.');
    setBusy(true);
    try {
      const r = await startStudio(liveId);
      if (r.error) return void toast.error(r.error);
      const m = mixer();
      await m.ctx.resume();
      const q = QUALITIES[quality];
      const stream = new MediaStream([videoTrack.current, m.dest.stream.getAudioTracks()[0]]);
      const b = new Broadcaster({ liveId, stream, width: q.w, height: q.h, fps: 30, videoBitrate: q.bitrate, onStatus: setStatus });
      caster.current = b;
      await b.start();
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
          <video ref={videoRef} autoPlay muted playsInline className="size-full object-contain" />
          {onAir && (
            <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO · {clock(status?.seconds ?? 0)}
            </span>
          )}
          {status?.state === 'reconnecting' && <span className="absolute top-3 right-3 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-bold text-black">Reconectando…</span>}
        </div>
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
            <Camera className="size-3.5" /> Vídeo
          </span>
          <Select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              if (e.target.value === 'screen') void shareScreen();
            }}
          >
            {cams.map((c, i) => (
              <option key={c.deviceId || i} value={c.deviceId}>
                {c.label || `Câmera ${i + 1}`}
              </option>
            ))}
            {canShare && <option value="screen">Compartilhar tela</option>}
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Mic className="size-3.5" /> Microfone
          </span>
          <Select value={mic} onChange={(e) => setMic(e.target.value)}>
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
        {source === 'screen' && !onAir && (
          <button type="button" onClick={shareScreen} className={buttonClass('secondary', 'sm', 'w-full')}>
            <MonitorUp className="size-4" /> Escolher outra tela
          </button>
        )}

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
