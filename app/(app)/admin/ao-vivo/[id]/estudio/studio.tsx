'use client';

import {
  AppWindow,
  RefreshCw,
  X,
  MessageSquare,
  Maximize2,
  Minimize2,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  FileText,
  FlipHorizontal2,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PictureInPicture2,
  Radio,
  Settings2,
  Video,
  Wifi,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmDialog } from '@/components/confirm';
import { toast } from '@/components/toast';
import { buttonClass, Select } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { Broadcaster, checkSupport, type BroadcastStatus } from '@/lib/live/broadcaster';
import { Compositor, type Fit, type Scene } from '@/lib/live/compositor';
import { PdfPresenter, type PdfView } from '@/lib/live/pdf-presenter';
import { getFileUrl } from '@/lib/storage/client';
import type { LessonMaterial, LiveMessage, ProfileCard } from '@/lib/types';
import { LiveChat } from '../../../../ao-vivo/[id]/live-room';
import { cn } from '@/lib/utils';
import { startStudio, stopStudio } from '../../../live-actions';

// Resolução (a C922 vai até 1080p) e taxa de vídeo pela conexão, como a "taxa dinâmica" do OBS:
// Automático (Wi‑Fi) começa no máximo e se ajusta à velocidade de envio; Econômico (dados móveis) fica travado em 4 Mbps.
const RES = {
  '1080': { w: 1920, h: 1080, min: 4_500_000, max: 10_000_000, label: '1080p (mais detalhes)' },
  '720': { w: 1280, h: 720, min: 4_000_000, max: 8_000_000, label: '720p' },
} as const;
type Res = keyof typeof RES;
const NET = { auto: 'Automático (Wi‑Fi)', eco: 'Econômico (dados móveis)' } as const;
const mbps = (b: number) => (b / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const rangeOf = (res: Res, net: Net) => (net === 'eco' ? { min: 4_000_000, max: 4_000_000 } : { min: RES[res].min, max: RES[res].max });
const netLabel = (res: Res, net: Net) => {
  const r = rangeOf(res, net);
  return `${NET[net]} · ${r.min === r.max ? mbps(r.max) : `${mbps(r.min)} a ${mbps(r.max)}`} Mbps`;
};
function initialRes(): Res {
  try {
    if (localStorage.getItem('studio-res') === '720') return '720';
  } catch {}
  return '1080';
}
type Net = keyof typeof NET;
function initialNet(): Net {
  try {
    const saved = localStorage.getItem('studio-net');
    if (saved === 'auto' || saved === 'eco') return saved;
  } catch {}
  const c = (navigator as Navigator & { connection?: { type?: string } }).connection;
  return c?.type === 'cellular' ? 'eco' : 'auto';
}

const SCENES: {
  key: Scene;
  label: string;
  icon: typeof Video;
  desktop?: boolean;
}[] = [
  { key: 'camera', label: 'Câmera', icon: Video },
  { key: 'pdf', label: 'PDF + câmera', icon: FileText },
  { key: 'screen', label: 'Só tela', icon: Monitor, desktop: true },
  {
    key: 'both',
    label: 'Tela + câmera',
    icon: PictureInPicture2,
    desktop: true,
  },
];

function MirrorButton({ mirror, onToggle }: { mirror: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={mirror}
      className={buttonClass(mirror ? 'primary' : 'secondary', 'sm', 'w-full')}
      aria-label="Espelhar câmera"
    >
      <FlipHorizontal2 className="size-4" /> Espelhar
    </button>
  );
}

/** Nomes que o Android dá aos microfones, em português (no computador vem o nome do aparelho). */
function micName(d: MediaDeviceInfo, i: number) {
  const l = d.label.trim();
  if (!l) return `Microfone ${i + 1}`;
  if (/^speakerphone$/i.test(l)) return 'Microfone do celular';
  if (/headset earpiece|earpiece/i.test(l)) return 'Microfone do celular (modo chamada)';
  if (/bluetooth/i.test(l)) return l.replace(/bluetooth headset/i, '').trim() ? `Bluetooth: ${l.replace(/bluetooth headset/i, '').trim()}` : 'Fone Bluetooth';
  if (/^usb (headset|audio|device|microphone)$/i.test(l)) return 'Microfone USB';
  if (/^(wired )?headset$/i.test(l)) return 'Fone com fio';
  if (/^default$/i.test(l)) return 'Padrão do sistema';
  return l.replace(/^Default - /i, 'Padrão: ').replace(/^Communications - /i, 'Chamadas: ');
}
function camName(d: MediaDeviceInfo, i: number, all: MediaDeviceInfo[]) {
  const l = d.label.trim();
  if (!l) return `Câmera ${i + 1}`;
  const side = /facing back|back|rear|traseira/i.test(l) ? 'back' : /facing front|front|frontal|user/i.test(l) ? 'front' : '';
  if (!side || !/^camera\s*\d/i.test(l)) return l;
  const same = all.filter((x) => (side === 'back' ? /facing back/i : /facing front/i).test(x.label));
  const n = same.indexOf(d);
  const base = side === 'back' ? 'Câmera traseira' : 'Câmera frontal';
  return same.length > 1 ? `${base} ${n + 1}` : base;
}

const clock = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Estúdio: escolhe câmera, microfone e a tela (inteira ou uma janela), monta a cena e transmite direto
 * para o YouTube. Três cenas, como no OBS: só a câmera, só a tela, ou a tela com a câmera no canto.
 * Dá para trocar de cena no meio da live. O áudio passa por um mixer: trocar o microfone não corta o som.
 */
export function Studio({
  liveId,
  live,
  ready,
  hint,
  materials = [],
  chat,
  pdfPanel,
}: {
  liveId: string;
  live: boolean;
  ready: boolean;
  hint: string;
  materials?: LessonMaterial[];
  /** chat ao lado na tela cheia (só o professor vê assim) */
  chat?: { initial: LiveMessage[]; me: ProfileCard };
  /** quadro dos PDFs da live */
  pdfPanel?: React.ReactNode;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const comp = useRef<Compositor | null>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cam, setCam] = useState<string>(''); // deviceId ou 'none'
  const [mic, setMic] = useState<string>(''); // deviceId ou 'none'
  const [scene, setScene] = useState<Scene>('camera');
  // quadradinho da câmera: posição e tamanho (guardados para as próximas lives)
  const [pipBox, setPipBox] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem('studio-pip') ?? '');
      if (typeof v?.x === 'number' && typeof v?.y === 'number' && typeof v?.w === 'number') return v as { x: number; y: number; w: number };
    } catch {
      /* primeira vez */
    }
    return { x: 0.7, y: 0.55, w: 0.28 };
  });
  const [pipSel, setPipSel] = useState(false);
  const [pipRect, setPipRect] = useState({ x: 0.7, y: 0.55, w: 0.28, h: 0.28 });
  const pipDrag = useRef<{
    mode: 'move' | 'size';
    sx: number;
    sy: number;
    box: { x: number; y: number; w: number };
    moved: boolean;
    t: number;
  } | null>(null);
  const pipTouches = useRef(new Map<number, { x: number; y: number }>());
  const pipArea = useRef<HTMLDivElement>(null);
  const [screenOn, setScreenOn] = useState(false);
  const [net, setNet] = useState<Net>('auto');
  useEffect(() => setNet(initialNet()), []);
  function pickNet(n: Net) {
    setNet(n);
    try {
      localStorage.setItem('studio-net', n);
    } catch {}
    const r = rangeOf(res, n);
    caster.current?.setRange(r.min, r.max);
  }
  const [res, setRes] = useState<Res>('1080');
  useEffect(() => setRes(initialRes()), []);
  function pickRes(r: Res) {
    setRes(r);
    try {
      localStorage.setItem('studio-res', r);
    } catch {}
  }
  // a live é sempre horizontal (16:9)
  const vertical = false;
  const rotation = 0;
  const [mirror, setMirror] = useState(false);
  const fit: Fit = 'cover';
  const [pip, setPip] = useState(true);
  const pdf = useRef<PdfPresenter | null>(null);
  const [pdfId, setPdfId] = useState('');
  const [pdfView, setPdfView] = useState<PdfView | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastTap = useRef(0);
  const [pageInput, setPageInput] = useState('');
  const [choosing, setChoosing] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [camPortrait, setCamPortrait] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [pop, setPop] = useState<'mic' | 'cam' | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [level, setLevel] = useState(0);
  const [support, setSupport] = useState<{
    ok: boolean;
    reason?: string;
  } | null>(null);
  const [status, setStatus] = useState<BroadcastStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [permError, setPermError] = useState('');
  const [canShare, setCanShare] = useState(false);

  const camTrack = useRef<MediaStreamTrack | null>(null);
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const audio = useRef<{
    ctx: AudioContext;
    dest: MediaStreamAudioDestinationNode;
    analyser: AnalyserNode;
    gain: GainNode;
    src?: MediaStreamAudioSourceNode;
  } | null>(null);
  const [muted, setMuted] = useState(false);
  /** nome do microfone que está captando de verdade (o que o sistema entregou) */
  const [micLabel, setMicLabel] = useState('');
  const caster = useRef<Broadcaster | null>(null);
  const onAir = status?.state === 'live' || status?.state === 'starting' || status?.state === 'reconnecting';

  // Mixer de áudio (sempre existe uma trilha de áudio, mesmo sem microfone)
  const mixer = useCallback(() => {
    if (!audio.current) {
      const ctx = new AudioContext({ sampleRate: 48000 });
      const dest = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      // microfone → volume (silenciar) → live; o medidor mostra o que vai para a live
      const gain = ctx.createGain();
      gain.connect(dest);
      gain.connect(analyser);
      audio.current = { ctx, dest, analyser, gain };
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
        const s = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        s.getTracks().forEach((t) => t.stop());
      } catch {
        setPermError('Libere o acesso à câmera e ao microfone no navegador para usar o estúdio.');
      }
      await refreshDevices(true);
      setCanShare('getDisplayMedia' in navigator.mediaDevices);
    })();
    // Conectou ou tirou um microfone/câmera (USB, Bluetooth, fio): a lista atualiza sozinha
    const onChange = () => void refreshDevices(false);
    navigator.mediaDevices.addEventListener?.('devicechange', onChange);
    // Alguns celulares (Android) não avisam quando um microfone USB é ligado: confere a lista a cada 3 s
    const poll = window.setInterval(onChange, 3000);
    const onVisible = () => document.visibilityState === 'visible' && onChange();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.mediaDevices.removeEventListener?.('devicechange', onChange);
      comp.current?.destroy();
      pdf.current?.destroy();
      camTrack.current?.stop();
      screenTrack.current?.stop();
      micStream.current?.getTracks().forEach((t) => t.stop());
      void audio.current?.ctx.close();
    };
  }, []);

  const knownMics = useRef<Set<string> | null>(null);
  /** Lê a lista de câmeras e microfones. Microfone novo conectado já fica escolhido. */
  async function refreshDevices(first: boolean) {
    const list = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    const c = list.filter((d) => d.kind === 'videoinput');
    const m = list.filter((d) => d.kind === 'audioinput');
    setCams(c);
    setMics(m);
    setCam((v) => (v && (v === 'none' || c.some((x) => x.deviceId === v)) ? v : c[0]?.deviceId || 'none'));
    const before = knownMics.current;
    knownMics.current = new Set(m.map((x) => x.deviceId));
    const added = before && !first ? m.filter((x) => !before.has(x.deviceId) && !/^(default|communications)$/.test(x.deviceId)) : [];
    if (added[0]) {
      setMic(added[0].deviceId);
      toast(`Microfone conectado: ${micName(added[0], m.indexOf(added[0]))}`);
    } else setMic((v) => (v && (v === 'none' || m.some((x) => x.deviceId === v)) ? v : m[0]?.deviceId || 'none'));
  }

  /** Botão "procurar": pede o microfone de novo (o Android só mostra o USB depois disso) e relê a lista. */
  async function searchDevices() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      /* sem permissão */
    }
    await refreshDevices(false);
    toast('Lista de microfones e câmeras atualizada');
  }

  // Tamanho do quadro = qualidade e formato (horizontal 16:9 ou vertical 9:16)
  const dims = () => {
    const q = RES[res];
    return vertical ? { w: q.h, h: q.w } : { w: q.w, h: q.h };
  };
  useEffect(() => {
    const d = dims();
    comp.current?.resize(d.w, d.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, vertical]);

  // Cena, canto, giro, espelho e encaixe da câmera
  useEffect(() => {
    const c = comp.current;
    if (!c) return;
    c.scene = scene;
    c.pipX = pipBox.x;
    c.pipY = pipBox.y;
    c.pipW = pipBox.w;
    c.rotation = rotation;
    c.mirror = mirror;
    c.fit = fit;
    c.pip = pip;
    setPipRect(c.pipRect());
  }, [scene, pipBox, rotation, mirror, fit, pip]);

  // o retângulo do quadradinho acompanha o formato da câmera
  useEffect(() => {
    const t = window.setInterval(() => {
      const r = comp.current?.pipRect();
      if (r) setPipRect((o) => (o.x === r.x && o.y === r.y && o.w === r.w && o.h === r.h ? o : r));
    }, 700);
    return () => window.clearInterval(t);
  }, []);

  const savePip = (b: { x: number; y: number; w: number }) => {
    try {
      localStorage.setItem('studio-pip', JSON.stringify(b));
    } catch {
      /* navegador sem armazenamento */
    }
  };

  // Quadradinho da câmera: arrastar move para qualquer lugar; tocar mostra a alça de tamanho; pinça também muda o tamanho
  const pipDown = (e: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'size') => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pipTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pipDrag.current = {
      mode,
      sx: e.clientX,
      sy: e.clientY,
      box: { ...pipBox, x: pipRect.x, y: pipRect.y },
      moved: false,
      t: Date.now(),
    };
  };
  const pipMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = pipDrag.current;
    const stageEl = pipArea.current;
    if (!d || !stageEl) return;
    const r = stageEl.getBoundingClientRect();
    const ts = pipTouches.current;
    const prev = ts.get(e.pointerId);
    ts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ts.size === 2 && prev) {
      // pinça no quadradinho: tamanho
      const other = [...ts.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (d0 > 0)
        setPipBox((b) => ({
          ...b,
          w: Math.min(0.6, Math.max(0.12, b.w * (d1 / d0))),
        }));
      d.moved = true;
      return;
    }
    const dx = (e.clientX - d.sx) / r.width;
    const dy = (e.clientY - d.sy) / r.height;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    if (d.mode === 'move') setPipBox({ ...d.box, x: d.box.x + dx, y: d.box.y + dy });
    else setPipBox({ ...d.box, w: Math.min(0.6, Math.max(0.12, d.box.w + dx)) });
  };
  const pipUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pipTouches.current.delete(e.pointerId);
    const d = pipDrag.current;
    if (!d) return;
    if (!d.moved && d.mode === 'move' && Date.now() - d.t < 400) setPipSel((v) => !v);
    if (pipTouches.current.size === 0) {
      pipDrag.current = null;
      setPipBox((b) => {
        const fixed = {
          x: Math.min(Math.max(0, b.x), 1 - pipRect.w),
          y: Math.min(Math.max(0, b.y), 1 - pipRect.h),
          w: b.w,
        };
        savePip(fixed);
        return fixed;
      });
    }
  };

  // Tela ligada durante a live (o celular não apaga a tela no meio da aula)
  useEffect(() => {
    if (!onAir || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const get = () =>
      (
        navigator as Navigator & {
          wakeLock: {
            request: (t: 'screen') => Promise<{ release: () => Promise<void> }>;
          };
        }
      ).wakeLock
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

  // Câmera em pé (celular na vertical)? Mostra o aviso para deitar o aparelho
  useEffect(() => {
    setMobile(
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) ||
        window.matchMedia('(pointer: coarse)').matches,
    );
    const t = window.setInterval(() => setCamPortrait(Boolean(comp.current?.cameraPortrait)), 800);
    const onFs = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  /** Tela cheia deitada: a câmera passa a filmar na horizontal de verdade (celular deitado). */
  async function enterFull() {
    setPop(null);
    setFull(true);
    try {
      await stage.current?.requestFullscreen?.({ navigationUI: 'hide' });
    } catch {
      /* iPhone: sem tela cheia de página; o modo ocupa a tela mesmo assim */
    }
    try {
      await (
        screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>;
        }
      ).lock?.('landscape');
    } catch {
      /* sem trava de orientação (iPhone/iPad): basta deitar o aparelho */
    }
  }
  async function exitFull() {
    setPop(null);
    setFull(false);
    try {
      screen.orientation?.unlock?.();
    } catch {
      /* */
    }
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }

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
    // tocar na tela fecha o popup de microfone/câmera
    if (pop) {
      setPop(null);
      return;
    }
    if (scene === 'camera') {
      // câmera: arrastar escolhe a parte da imagem que aparece no recorte
      e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
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
    if (prev && scene === 'camera' && ps.size === 1) {
      const rc = e.currentTarget.getBoundingClientRect();
      comp.current?.moveCamera((e.clientX - prev.x) / rc.width, (e.clientY - prev.y) / rc.height);
      ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    if (!prev || scene !== 'pdf' || !pdf.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (ps.size === 1) {
      pdf.current.pan((e.clientX - prev.x) / r.width, (e.clientY - prev.y) / r.height);
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
      else pdf.current.pan(-e.deltaX / r.width, -e.deltaY / r.height);
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
    navigator.mediaDevices
      .getUserMedia({
        video: {
          deviceId: { exact: cam },
          width: { ideal: RES[res].w },
          height: { ideal: RES[res].h },
          aspectRatio: { ideal: 16 / 9 },
          frameRate: { ideal: 30 },
        },
      })
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
  }, [cam, res]);

  /** Espelhar a tela inteira ou uma janela (o navegador mostra a lista para escolher). */
  async function shareScreen(surface: 'monitor' | 'window') {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          displaySurface: surface,
        } as MediaTrackConstraints,
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
    setMicLabel('');
    if (mic === 'none') return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: { exact: mic },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        micStream.current = s;
        setMicLabel(s.getAudioTracks()[0]?.label ?? '');
        const src = m.ctx.createMediaStreamSource(s);
        src.connect(m.gain);
        m.src = src;
      })
      .catch(() => toast.error('Não foi possível abrir este microfone.'));
    return () => {
      cancelled = true;
    };
  }, [mic, mixer]);

  // Silenciar o microfone (a live continua, só sem som)
  useEffect(() => {
    const g = mixer().gain;
    g.gain.setTargetAtTime(muted ? 0 : 1, g.context.currentTime, 0.02);
  }, [muted, mixer]);

  // Medidor do microfone
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const buf = new Uint8Array(256);
    const loop = (t: number) => {
      const a = audio.current?.analyser;
      // poucas atualizações por segundo: redesenhar o estúdio 60x/s rouba tempo da imagem da live
      if (a && t - last > 80) {
        last = t;
        a.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        const v = Math.round(Math.min(1, peak / 90) * 20) / 20;
        setLevel((o) => (o === v ? o : v));
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
      const n = rangeOf(res, net);
      const d = dims();
      // Só o áudio vai pela trilha; o vídeo vem da mesa de cenas (quadro a quadro)
      const stream = new MediaStream([m.dest.stream.getAudioTracks()[0]]);
      const b = new Broadcaster({
        liveId,
        stream,
        width: d.w,
        height: d.h,
        fps: 30,
        videoBitrate: n.max,
        minBitrate: n.min,
        maxBitrate: n.max,
        onStatus: setStatus,
        // Safari/iPad: o som vai direto do mixer (já com o silenciar aplicado)
        audioSource: { ctx: m.ctx, node: m.gain },
      });
      caster.current = b;
      await b.start();
      if (comp.current) comp.current.onFrame = (c) => b.pushFrame(c);
      toast('Transmissão iniciada');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const [confirmEnd, setConfirmEnd] = useState(false);
  /** Encerrar: na tela cheia a confirmação aparece na própria tela da live (fora dela o navegador esconde) */
  async function endLive(confirmed = false) {
    if (!confirmed) {
      if (full) return setConfirmEnd(true);
      if (!(await confirmDialog('Encerrar a transmissão?'))) return;
    }
    setConfirmEnd(false);
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

  const pdfList = (
    <ul className="space-y-1.5">
      {materials.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => {
              setChoosing(false);
              void openPdf(m.id);
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-surface-2',
              pdfId === m.id ? 'border-brand bg-brand/10' : 'border-line',
            )}
          >
            <FileText className="size-5 shrink-0 text-danger" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.title}</span>
            {pdfId === m.id && <span className="text-[11px] text-brand">aberto</span>}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="order-1 min-w-0 space-y-3 lg:col-start-1 lg:row-start-1">
        <div
          ref={stage}
          className={cn(
            'relative mx-auto overflow-hidden bg-black',
            full ? 'fixed inset-0 z-[90] flex' : cn('rounded-2xl border border-line', vertical ? 'aspect-[9/16] max-h-[70dvh]' : 'aspect-video w-full'),
          )}
        >
          <div className={full ? 'relative flex h-full min-w-0 flex-1 items-center justify-center' : 'absolute inset-0'}>
            <div
              className="relative"
              style={
                full
                  ? {
                      width: 'min(100%, calc(100dvh * 16 / 9))',
                      aspectRatio: '16 / 9',
                    }
                  : { position: 'absolute', inset: 0 }
              }
            >
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                className={cn(
                  'size-full object-contain',
                  (scene === 'pdf' || (scene === 'camera' && fit === 'cover')) && 'cursor-grab touch-none active:cursor-grabbing',
                )}
                data-zoom={pdfView?.zoom.toFixed(2)}
                aria-label="Prévia da transmissão"
              />
              {/* Quadradinho da câmera: arraste para qualquer lugar; toque para mudar o tamanho (não aparece na live) */}
              {(scene === 'both' || (scene === 'pdf' && pip)) && camTrack.current && (
                <div ref={pipArea} className="pointer-events-none absolute inset-0">
                  <div
                    role="button"
                    aria-label="Quadradinho da câmera"
                    onPointerDown={(e) => pipDown(e, 'move')}
                    onPointerMove={pipMove}
                    onPointerUp={pipUp}
                    onPointerCancel={pipUp}
                    className={cn(
                      'pointer-events-auto absolute cursor-move touch-none rounded-[6%]',
                      pipSel && 'ring-2 ring-brand ring-offset-1 ring-offset-transparent',
                    )}
                    style={{
                      left: `${pipRect.x * 100}%`,
                      top: `${pipRect.y * 100}%`,
                      width: `${pipRect.w * 100}%`,
                      height: `${pipRect.h * 100}%`,
                    }}
                  >
                    {pipSel && (
                      <div
                        role="button"
                        aria-label="Mudar o tamanho da câmera"
                        onPointerDown={(e) => pipDown(e, 'size')}
                        onPointerMove={pipMove}
                        onPointerUp={pipUp}
                        onPointerCancel={pipUp}
                        className="absolute -right-2.5 -bottom-2.5 grid size-7 cursor-nwse-resize touch-none place-items-center rounded-full border-2 border-white bg-brand shadow"
                      >
                        <Maximize2 className="size-3.5 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {onAir && (
              <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO · {clock(status?.seconds ?? 0)}
              </span>
            )}
            <div className={cn('absolute right-2 flex items-center gap-1.5', status?.state === 'reconnecting' ? 'top-10' : 'top-2')}>
              {scene === 'pdf' && materials.length > 1 && (
                <button
                  type="button"
                  onClick={() => setChoosing(true)}
                  aria-label="Trocar de PDF"
                  title="Trocar de PDF"
                  className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-black/75"
                >
                  <FileText className="size-3.5" /> Trocar
                </button>
              )}
              {
                <>
                  <button
                    type="button"
                    onClick={() => setPop((v) => (v === 'mic' ? null : 'mic'))}
                    aria-label="Escolher microfone"
                    className={cn(
                      'grid size-9 place-items-center rounded-full text-white backdrop-blur',
                      muted || mic === 'none' ? 'bg-red-600' : 'bg-black/55',
                    )}
                  >
                    {muted || mic === 'none' ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPop((v) => (v === 'cam' ? null : 'cam'))}
                    aria-label="Escolher câmera"
                    className="grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
                  >
                    <Camera className="size-4" />
                  </button>
                  {full && chat && (
                    <button
                      type="button"
                      onClick={() => setChatOpen((v) => !v)}
                      aria-label={chatOpen ? 'Esconder chat' : 'Mostrar chat'}
                      className={cn('grid size-9 place-items-center rounded-full text-white backdrop-blur', chatOpen ? 'bg-brand' : 'bg-black/55')}
                    >
                      <MessageSquare className="size-4" />
                    </button>
                  )}
                  {full && (
                    <button
                      type="button"
                      onClick={exitFull}
                      aria-label="Sair da tela cheia"
                      className="grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
                    >
                      <Minimize2 className="size-4" />
                    </button>
                  )}
                </>
              }
            </div>

            {/* Popups de microfone e câmera (tela cheia) */}
            {pop && (
              <div
                data-popup={pop}
                className="absolute top-12 right-2 z-10 max-h-[calc(100%-3.5rem)] w-64 max-w-[calc(100%-1rem)] space-y-2 overflow-y-auto rounded-2xl border border-line-strong bg-surface/95 p-3 shadow-2xl backdrop-blur"
              >
                {pop === 'mic' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMuted((v) => !v)}
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold',
                        muted ? 'bg-red-600 text-white' : 'bg-surface-3 text-ink',
                      )}
                    >
                      {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />} {muted ? 'Microfone silenciado' : 'Silenciar microfone'}
                    </button>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-success" style={{ width: `${Math.round(level * 100)}%` }} />
                    </div>
                    {micLabel && <p className="truncate text-center text-[11px] text-muted">Captando: {micLabel}</p>}
                    <button
                      type="button"
                      onClick={searchDevices}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand"
                    >
                      <RefreshCw className="size-3.5" /> Procurar microfones
                    </button>
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {[
                        ...mics.map((m, i) => ({
                          id: m.deviceId,
                          name: micName(m, i),
                        })),
                        { id: 'none', name: 'Sem microfone' },
                      ].map((o) => (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => setMic(o.id)}
                            className={cn(
                              'w-full truncate rounded-lg px-2.5 py-2 text-left text-xs',
                              mic === o.id ? 'bg-brand text-white' : 'text-ink hover:bg-surface-2',
                            )}
                          >
                            {o.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {[
                        ...cams.map((c, i) => ({
                          id: c.deviceId,
                          name: camName(c, i, cams),
                        })),
                        { id: 'none', name: 'Sem câmera' },
                      ].map((o) => (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => setCam(o.id)}
                            className={cn(
                              'w-full truncate rounded-lg px-2.5 py-2 text-left text-xs',
                              cam === o.id ? 'bg-brand text-white' : 'text-ink hover:bg-surface-2',
                            )}
                          >
                            {o.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <MirrorButton mirror={mirror} onToggle={() => setMirror((m) => !m)} />
                  </>
                )}
              </div>
            )}
            {status?.state === 'reconnecting' && (
              <span className="absolute top-3 right-3 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-bold text-black">Reconectando…</span>
            )}

            {/* Câmera em pé: avisa para deitar o celular */}
            {camPortrait && scene === 'camera' && fit === 'cover' && !onAir && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2">
                <span className="rounded-full bg-black/65 px-3 py-1.5 text-center text-[11px] font-semibold text-white backdrop-blur">
                  Celular em pé: a live mostra um recorte horizontal. Arraste para escolher a parte.
                </span>
              </div>
            )}

            {/* Controles na tela cheia */}
            {full && (
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {SCENES.filter((x) => canShare || !x.desktop).map((x) => (
                  <button
                    key={x.key}
                    type="button"
                    onClick={() => pickScene(x.key)}
                    aria-pressed={scene === x.key}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold backdrop-blur',
                      scene === x.key ? 'bg-red-600 text-white' : 'bg-black/55 text-white',
                    )}
                  >
                    <x.icon className="size-4" /> {x.label}
                  </button>
                ))}
                {scene === 'pdf' && pdfView && pdfView.pages > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-black/55 px-1 py-1 text-xs font-semibold text-white backdrop-blur">
                    <button
                      type="button"
                      onClick={() => void pdf.current?.goTo(pdfView.page - 1)}
                      aria-label="Página anterior"
                      className="grid size-7 place-items-center rounded-full"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="tabular-nums">
                      {pdfView.page}/{pdfView.pages}
                    </span>
                    <button
                      type="button"
                      onClick={() => void pdf.current?.goTo(pdfView.page + 1)}
                      aria-label="Próxima página"
                      className="grid size-7 place-items-center rounded-full"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </span>
                )}
                {onAir ? (
                  <button
                    type="button"
                    onClick={() => void endLive()}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-black"
                  >
                    <CircleStop className="size-4" /> Encerrar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goLive}
                    disabled={busy || blocked}
                    className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busy ? <Spinner /> : <Radio className="size-4" />} Iniciar
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Na tela cheia, as janelas aparecem dentro da própria tela da live */}
          {full && (confirmEnd || choosing) && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
              <div className="w-full max-w-sm space-y-4 rounded-3xl border border-line-strong bg-surface p-5 shadow-2xl">
                {confirmEnd ? (
                  <>
                    <p className="text-base font-bold text-ink">Encerrar a transmissão?</p>
                    <p className="text-sm text-muted">A gravação vira aula na pasta Live.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setConfirmEnd(false)} className={buttonClass('secondary', 'md')}>
                        Continuar ao vivo
                      </button>
                      <button
                        type="button"
                        onClick={() => void endLive(true)}
                        disabled={busy}
                        className={buttonClass('primary', 'md', '!bg-red-600 hover:!bg-red-700')}
                      >
                        {busy ? <Spinner /> : <CircleStop className="size-4" />} Encerrar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-base font-bold text-ink">Qual PDF mostrar?</p>
                      <button type="button" onClick={() => setChoosing(false)} aria-label="Fechar" className={buttonClass('ghost', 'icon', 'size-8')}>
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="max-h-[50dvh] overflow-y-auto">{pdfList}</div>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Chat ao lado, só para o professor, na tela cheia horizontal */}
          {full && chat && chatOpen && (
            <aside className="h-full w-[min(34%,340px)] shrink-0 border-l border-white/10 bg-surface">
              <LiveChat
                liveId={liveId}
                initial={chat.initial}
                me={chat.me}
                isAdmin
                canSend
                isLive
                className="flex h-full flex-col overflow-hidden rounded-none border-0"
              />
            </aside>
          )}
        </div>

        {mobile && !full && (
          <button type="button" onClick={enterFull} className={buttonClass('secondary', 'md', 'w-full')}>
            <Maximize2 className="size-4" /> Tela cheia na horizontal
          </button>
        )}

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
              <Select
                value={pdfId}
                onChange={(e) => void openPdf(e.target.value)}
                aria-label="PDF para mostrar"
                className={materials.length > 1 ? 'hidden' : ''}
              >
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
              <p className="text-xs text-muted">Suba o PDF em “PDFs da live”, abaixo.</p>
            )}
            {pdfBusy && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Spinner /> Abrindo o PDF…
              </p>
            )}
            {pdfView && pdfView.pages > 0 && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void pdf.current?.goTo(pdfView.page - 1)}
                    disabled={pdfView.page <= 1}
                    aria-label="Página anterior"
                    className={buttonClass('secondary', 'icon', 'size-11')}
                  >
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
                  <button
                    type="button"
                    onClick={() => void pdf.current?.goTo(pdfView.page + 1)}
                    disabled={pdfView.page >= pdfView.pages}
                    aria-label="Próxima página"
                    className={buttonClass('secondary', 'icon', 'size-11')}
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  <input type="checkbox" checked={pip} onChange={(e) => setPip(e.target.checked)} className="size-4 accent-[#3b82f6]" /> Minha câmera no canto
                </label>
                <MirrorButton mirror={mirror} onToggle={() => setMirror((m) => !m)} />
              </>
            )}
          </div>
        )}

        {onAir || status?.state === 'stopped' ? (
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="text-muted">Tempo</p>
              <p className="font-bold text-ink tabular-nums">{clock(status?.seconds ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="text-muted">Taxa</p>
              <p className="font-bold text-ink tabular-nums">{((status?.rate ?? 0) / 1000).toFixed(1)} Mbps</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="text-muted">Quadros</p>
              <p className={cn('font-bold tabular-nums', (status?.lost ?? 0) >= 10 ? 'text-warning' : 'text-ink')}>{status?.fps ?? 0} fps</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="flex items-center justify-center gap-1 text-muted">
                <Wifi className="size-3" /> Fila
              </p>
              <p className={cn('font-bold tabular-nums', (status?.queue ?? 0) > 2 ? 'text-warning' : 'text-ink')}>{status?.queue ?? 0}</p>
            </div>
          </div>
        ) : null}
        {onAir && (status?.lost ?? 0) >= 10 && (
          <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            O aparelho está perdendo {status?.lost}% dos quadros. Feche outros apps ou abas{res === '1080' ? '; se continuar, use 720p na próxima live' : ''}.
          </p>
        )}
        {status?.state === 'error' && <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{status.message}</p>}
      </div>

      <div className="order-2 space-y-3 lg:col-start-2 lg:row-start-2">
        {/* Iniciar/encerrar logo abaixo do chat, antes das configurações */}
        {onAir ? (
          <button type="button" onClick={() => void endLive()} disabled={busy} className={buttonClass('secondary', 'lg', 'w-full')}>
            {busy ? <Spinner /> : <CircleStop className="size-4" />} Encerrar transmissão
          </button>
        ) : (
          <button type="button" onClick={goLive} disabled={busy || blocked} className={buttonClass('primary', 'lg', 'w-full !bg-red-600 hover:!bg-red-700')}>
            {busy ? <Spinner /> : <Radio className="size-4" />} {live ? 'Transmitir (sala já está no ar)' : 'Iniciar transmissão'}
          </button>
        )}
        <p className="text-xs text-muted">{support && !support.ok ? support.reason : permError || hint}</p>
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Camera className="size-3.5" /> Câmera
          </span>
          <Select value={cam} onChange={(e) => setCam(e.target.value)} aria-label="Câmera">
            {cams.map((c, i) => (
              <option key={c.deviceId || i} value={c.deviceId}>
                {camName(c, i, cams)}
              </option>
            ))}
            <option value="none">Sem câmera</option>
          </Select>
        </label>
        {scene !== 'pdf' && <MirrorButton mirror={mirror} onToggle={() => setMirror((m) => !m)} />}

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
            <p className="text-xs text-muted">Não saia do navegador durante a live.</p>
          )}
          {screenOn && <p className="text-[11px] text-success">Tela espelhada. Pode trocar de janela: a live continua.</p>}
        </div>

        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Mic className="size-3.5" /> Microfone
          </span>
          <div className="flex gap-2">
            <Select value={mic} onChange={(e) => setMic(e.target.value)} aria-label="Microfone" className="min-w-0 flex-1">
              {mics.map((m, i) => (
                <option key={m.deviceId || i} value={m.deviceId}>
                  {micName(m, i)}
                </option>
              ))}
              <option value="none">Sem microfone</option>
            </Select>
            <button
              type="button"
              onClick={searchDevices}
              aria-label="Procurar microfones"
              title="Procurar microfones"
              className={buttonClass('secondary', 'icon', 'size-11 shrink-0')}
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
          {mic !== 'none' && (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                Captando: <strong className="text-ink-2">{micLabel || '…'}</strong>
              </span>
              <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-3">
                <span className={cn('block h-full rounded-full', level > 0.85 ? 'bg-danger' : 'bg-success')} style={{ width: `${Math.round(level * 100)}%` }} />
              </span>
            </div>
          )}
        </div>
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Settings2 className="size-3.5" /> Conexão
          </span>
          <Select value={net} onChange={(e) => pickNet(e.target.value as Net)} aria-label="Conexão">
            {(Object.keys(NET) as Net[]).map((k) => (
              <option key={k} value={k}>
                {netLabel(res, k)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Settings2 className="size-3.5" /> Resolução
          </span>
          <Select value={res} onChange={(e) => pickRes(e.target.value as Res)} disabled={onAir} aria-label="Resolução">
            {(Object.keys(RES) as Res[]).reverse().map((k) => (
              <option key={k} value={k}>
                {RES[k].label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {/* PDFs da live: embaixo da imagem no computador */}
      {pdfPanel && <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">{pdfPanel}</div>}
      {/* Chat: ao lado da imagem no computador; no fim da página no celular */}
      {chat && (
        <div className="order-4 lg:relative lg:col-start-2 lg:row-start-1">
          <LiveChat
            liveId={liveId}
            initial={chat.initial}
            me={chat.me}
            isAdmin
            canSend
            isLive
            className="flex h-[60dvh] flex-col overflow-hidden lg:absolute lg:inset-0 lg:h-auto"
          />
        </div>
      )}
      <Modal open={choosing && !full} onClose={() => setChoosing(false)} title="Qual PDF mostrar?" size="sm">
        {pdfList}
      </Modal>
    </div>
  );
}
