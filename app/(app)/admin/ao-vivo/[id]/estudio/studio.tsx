'use client';

import {
  AppWindow,
  Eraser,
  Hand,
  Highlighter,
  MousePointerClick,
  PenLine,
  Lasso,
  Shapes,
  Minus,
  MoveUpRight,
  Square,
  Circle,
  Trash2,
  Undo2,
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
import { claimStudio, pollStudio, rtcSend, setStudioScene, startStudio, stopStudio, getInk, inkOps, setStage, studioCommand, studioScan, type StudioDevice } from '../../../live-actions';
import { StudioLink, type LinkMsg } from '@/lib/live/studio-link';
import { InkLayer, newStrokeId, packOps, shapePoints, unpackOps, unpackStroke, type InkOps, type InkTool, type PackedOps, type ShapeKind, type Stroke } from '@/lib/live/ink';
import { confirmDialog } from '@/components/confirm';
import { toast } from '@/components/toast';
import { buttonClass, Select } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { Broadcaster, checkSupport, type BroadcastStatus, type ResumeState } from '@/lib/live/broadcaster';
import { Compositor, type Fit, type Scene } from '@/lib/live/compositor';
import { PdfPresenter, type PdfPos, type PdfView } from '@/lib/live/pdf-presenter';
import { getFileUrl } from '@/lib/storage/client';
import type { LessonMaterial, LiveMessage, ProfileCard } from '@/lib/types';
import { LiveChat } from '../../../../ao-vivo/[id]/live-room';
import { cn } from '@/lib/utils';

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

/**
 * Android: com o cancelamento de eco ligado, o Chrome abre o microfone em "modo chamada" e o sistema
 * usa o microfone interno, escondendo o USB (Lark, Rode, Boya…). Fora desse modo o próprio Android
 * passa a gravar pelo microfone USB quando ele está ligado. Esta opção usa esse caminho.
 */
const AUTO_MIC = 'auto-usb';
const AUTO_MIC_NAME = 'Automático (usa o USB/Lark se estiver ligado)';
/** Processamento de voz (eco, ruído, volume) só no microfone do próprio celular; microfone externo vai puro. */
const phoneMic = (label: string) => /speakerphone|earpiece/i.test(label);

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

// Escrita no PDF: cores e espessuras (em larguras de página)
const INK_COLORS = ['#111111', '#1d4ed8', '#dc2626', '#16a34a', '#facc15', '#ec4899'];
/** tamanho escolhido na régua (0,1 a 7) → espessura em larguras de página */
const INK_UNIT = { pen: 0.001, marker: 0.005, eraser: 0.004 } as const;
type Sized = keyof typeof INK_UNIT;
type InkPtr = { id: number; type: string; tool: InkTool; laser?: string; erased?: string[]; before?: Stroke[]; lasso?: number[]; from?: { x: number; y: number } };

const clock = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Estúdio: escolhe câmera, microfone e a tela (inteira ou uma janela), monta a cena e transmite direto
 * para o YouTube. Três cenas, como no OBS: só a câmera, só a tela, ou a tela com a câmera no canto.
 * Dá para trocar de cena no meio da live. O áudio passa por um mixer: trocar o microfone não corta o som.
 */
/** Este aparelho no estúdio (fica guardado no navegador) e um nome para os outros aparelhos verem. */
function studioDevice() {
  let id = '';
  try {
    id = localStorage.getItem('studio-device') ?? '';
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      localStorage.setItem('studio-device', id);
    }
  } catch {
    id = Math.random().toString(36).slice(2, 12);
  }
  const ua = navigator.userAgent;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const label = /iPad/.test(ua) || touchMac ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Celular Android' : 'Tablet Android') : /Mac/.test(ua) ? 'Mac' : 'Computador';
  return { id, label };
}

type StudioPoll = Awaited<ReturnType<typeof pollStudio>>;

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
  const [camInfo, setCamInfo] = useState<{ w: number; h: number; fps: number } | null>(null);
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
  // na tela cheia o chat fica recolhido: o PDF e a câmera ocupam a tela toda; o botão do chat abre e fecha
  const [chatOpen, setChatOpen] = useState(false);
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
  const [android, setAndroid] = useState(false);
  const [micKick, setMicKick] = useState(0); // reabre o microfone (ex.: ligou o USB)
  useEffect(() => setAndroid(/Android/i.test(navigator.userAgent)), []);
  const caster = useRef<Broadcaster | null>(null);
  const onAir = status?.state === 'live' || status?.state === 'starting' || status?.state === 'reconnecting';

  // ---- vários aparelhos na mesma live: um transmite, os outros mostram a mesma cena e controlam
  const device = useRef<{ id: string; label: string }>({ id: '', label: '' });
  const [remote, setRemote] = useState<StudioPoll>(null);
  const sync = useRef({ rev: 0, applying: false, sent: '', ready: false });
  const [autoTake, setAutoTake] = useState(false);
  useEffect(() => {
    device.current = studioDevice();
    try {
      setAutoTake(localStorage.getItem('studio-auto') === '1');
    } catch {}
  }, []);
  const liveOn = remote ? remote.status === 'live' : live;

  // Ligação direta com os outros aparelhos: espelho da live (imagem de quem transmite) e comandos na hora
  const link = useRef<StudioLink | null>(null);
  const [mirrorStream, setMirrorStream] = useState<MediaStream | null>(null);
  const mirrorVideo = useRef<HTMLVideoElement>(null);
  const mirrorSrc = useRef<MediaStream | null>(null);
  /** câmeras e microfones do aparelho que transmite (para trocar daqui) */
  const [hostDev, setHostDev] = useState<{ cams: { id: string; name: string }[]; mics: { id: string; name: string }[]; cam: string; mic: string } | null>(null);
  const onLinkMsg = useRef<(m: LinkMsg, from: string) => void>(() => {});
  const onLinkOpen = useRef<(d: string) => void>(() => {});
  /** este aparelho só controla: mostra a imagem de quem transmite */
  // (definido logo abaixo, depois do modo leve)
  /**
   * Modo leve: a live está no ar por outro aparelho e este só controla. Não abre câmera nem microfone,
   * não recebe o espelho (só se pedir) e desenha a prévia devagar: não esquenta nem gasta bateria.
   */
  const [armed, setArmed] = useState(false);
  /**
   * Aparelho principal do estúdio: o da câmera em uso (na live, o que transmite). Só ele abre câmera e microfone;
   * os outros só controlam e mostram a imagem dele. Muda quando você escolhe a câmera de outro aparelho.
   */
  const liveHolderDev = remote?.status === 'live' && remote.holder?.fresh ? remote.holder.device : '';
  const stageDev = liveHolderDev || (remote?.stage?.present ? remote.stage.device : '');
  const stageLabel = (liveHolderDev ? remote?.holder?.label : remote?.stage?.label) ?? '';
  const light = !onAir && !armed && (!remote || (stageDev !== '' && stageDev !== device.current.id));
  const viewing = Boolean(mirrorStream) && !onAir && light;
  // o aparelho que só controla sempre mostra a imagem do principal
  const wantMirrorRef = useRef(true);

  /**
   * Reserva do espelho: se a ligação direta não conecta (celular no 4G/5G, rede que bloqueia),
   * o principal manda uma foto pequena por segundo pelo servidor, só enquanto alguém precisa.
   */
  const [mirrorOk, setMirrorOk] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');
  const noMirrorSince = useRef(0);
  const needPreview = useRef(false);
  const pendingPreview = useRef('');
  useEffect(() => {
    const t = window.setInterval(() => {
      const v = mirrorVideo.current;
      const okNow = Boolean(v && v.srcObject && v.videoWidth > 0 && v.readyState >= 2);
      setMirrorOk(okNow);
      if (okNow || !light) noMirrorSince.current = 0;
      else if (!noMirrorSince.current) noMirrorSince.current = Date.now();
      needPreview.current = light && !okNow && noMirrorSince.current > 0 && Date.now() - noMirrorSince.current > 6000;
      if (!needPreview.current) setPreviewSrc((p) => (p ? '' : p));
    }, 1000);
    return () => window.clearInterval(t);
  }, [light]);
  /** foto pequena da imagem da live (aparelho principal) */
  const snapshot = () => {
    const c = canvasRef.current;
    if (!c) return '';
    const t = document.createElement('canvas');
    t.width = 480;
    t.height = Math.round((480 * c.height) / c.width);
    t.getContext('2d')?.drawImage(c, 0, 0, t.width, t.height);
    return t.toDataURL('image/jpeg', 0.55);
  };
  useEffect(() => {
    if (!onAir) comp.current?.setFps(light ? 4 : 30);
  }, [light, onAir]);
  /** aparelhos abertos no estúdio (nome, câmeras, microfones) */
  const [devices, setDevices] = useState<StudioDevice[]>([]);
  const reported = useRef({ key: '', at: 0 });
  const [scanning, setScanning] = useState(false);

  // ---- escrita por cima do PDF
  const ink = useRef(new InkLayer());
  const [inkTool, setInkTool] = useState<InkTool>('hand');
  /** caneta só no celular e no iPad (no Mac/Windows o estúdio fica como era; a escrita feita no iPad aparece igual) */
  const [canInk, setCanInk] = useState(false);
  useEffect(() => {
    try {
      const touch = window.matchMedia('(pointer: coarse)').matches;
      // iPad se apresenta como Mac; a tela de toque denuncia
      const ipad = navigator.maxTouchPoints > 1 && /Macintosh|iPad/.test(navigator.userAgent);
      setCanInk(touch || ipad || localStorage.getItem('studio-ink') === '1');
      // já usou a Apple Pencil aqui: a mão nunca escreve (só move e dá zoom)
      pencilSeen.current = localStorage.getItem('studio-pencil') === '1';
    } catch {}
  }, []);
  const [inkColor, setInkColor] = useState('#111111');
  // tamanho de cada ferramenta (0,1 a 7), lembrado neste aparelho
  const [inkW, setInkW] = useState<Record<Sized, number>>({ pen: 3, marker: 4, eraser: 4 });
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem('studio-ink-sizes') ?? 'null');
      if (v && typeof v === 'object') setInkW((o) => ({ ...o, ...Object.fromEntries(Object.entries(v).filter(([k, n]) => k in o && typeof n === 'number' && n >= 0.1 && n <= 7)) }));
    } catch {}
  }, []);
  const setSize = (k: Sized, n: number) =>
    setInkW((o) => {
      const next = { ...o, [k]: Math.min(7, Math.max(0.1, Math.round(n * 10) / 10)) };
      try {
        localStorage.setItem('studio-ink-sizes', JSON.stringify(next));
      } catch {}
      return next;
    });
  /** opções recolhidas da barra: cores ou tamanho */
  const [inkPop, setInkPop] = useState<'color' | 'size' | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('line');
  /** modo escrita: tela cheia com as ferramentas (fora dele o PDF só move e dá zoom) */
  const [writing, setWriting] = useState(false);
  const inkPtr = useRef<InkPtr | null>(null);
  const pencilSeen = useRef(false);
  /** último evento da Apple Pencil (a mão encostando logo depois é a palma, não um gesto) */
  const lastPen = useRef(0);
  /** posição do PDF quando um gesto de dedos começou */
  const viewSnap = useRef<{ cx: number; cy: number; zoom: number } | null>(null);
  const penBusy = () => inkPtr.current?.type === 'pen' || performance.now() - lastPen.current < 700;
  const undoStack = useRef<InkOps[]>([]);
  const inkQueue = useRef<InkOps>({});
  const inkTimer = useRef(0);
  const inkRevSeen = useRef(-1);
  /** laço da seleção sendo desenhado (aparece na camada rápida, não vai para a live) */
  const lasso = useRef<number[] | null>(null);
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selDrag = useRef<{ mode: 'move' | 'size'; sx: number; sy: number; before: Stroke[]; last: { dx: number; dy: number; s: number }; box: { x0: number; y0: number; w: number } } | null>(null);
  const stageClaimed = useRef(false);
  // som travado pelo sistema (iPad/iPhone que assumiu a live sem ninguém tocar na tela)
  const [soundLocked, setSoundLocked] = useState(false);
  useEffect(() => {
    if (!onAir) return setSoundLocked(false);
    const t = window.setInterval(() => setSoundLocked(Boolean(audio.current && audio.current.ctx.state !== 'running')), 2000);
    return () => window.clearInterval(t);
  }, [onAir]);
  // mexendo no PDF ou na câmera do canto aqui: mostra a prévia local na hora e volta para a imagem da live depois
  const [touching, setTouching] = useState(false);
  const touchTimer = useRef(0);
  const touched = () => {
    setTouching(true);
    window.clearTimeout(touchTimer.current);
    touchTimer.current = window.setTimeout(() => setTouching(false), 1800);
  };
  useEffect(() => {
    const l = new StudioLink((to, kind, sdp) => rtcSend(liveId, device.current.id, to, kind, sdp));
    l.onStream = setMirrorStream;
    l.onMessage = (m, from) => onLinkMsg.current(m, from);
    l.onOpen = (d) => onLinkOpen.current(d);
    link.current = l;
    return () => l.close();
  }, [liveId]);
  useEffect(() => {
    if (mirrorVideo.current) mirrorVideo.current.srcObject = mirrorStream;
    if (!mirrorStream) setHostDev(null);
  }, [mirrorStream, viewing]);


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
      // iPad/iPhone: o sistema pode pausar o som do site (notificação, Siri, ligação). Retoma sozinho.
      const wake = () => {
        if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {});
      };
      ctx.addEventListener('statechange', () => window.setTimeout(wake, 300));
      document.addEventListener('visibilitychange', wake);
      document.addEventListener('touchend', wake, { passive: true });
      document.addEventListener('click', wake);
    }
    return audio.current;
  }, []);

  // Mesa de cenas + permissão + lista de dispositivos
  useEffect(() => {
    if (canvasRef.current) comp.current = new Compositor(canvasRef.current, 30);
    pdf.current = new PdfPresenter();
    pdf.current.onChange = () => setPdfView(pdf.current!.view);
    pdf.current.onView = (v) => sendView.current(v);
    pdf.current.ink = ink.current;
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
      setMic((v) => (v === AUTO_MIC ? v : added[0].deviceId));
      toast(`Microfone conectado: ${micName(added[0], m.indexOf(added[0]))}`);
    } else {
      const isAndroid = /Android/i.test(navigator.userAgent);
      setMic((v) => (v && (v === 'none' || v === AUTO_MIC || m.some((x) => x.deviceId === v)) ? v : isAndroid ? AUTO_MIC : m[0]?.deviceId || 'none'));
    }
    // no Automático, um aparelho novo (USB ligado/desligado) reabre o microfone para o Android trocar a rota
    if (before && !first && (m.length !== before.size || m.some((x) => !before.has(x.deviceId)))) setMicKick((k) => k + 1);
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
    setMicKick((k) => k + 1);
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

  // o retângulo do quadradinho acompanha o formato da câmera (o principal mede e manda para os outros)
  const [pipAspect, setPipAspect] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      const r = comp.current?.pipRect();
      const c = canvasRef.current;
      if (r && c && camTrack.current) {
        const a = Math.round(((r.h * c.height) / (r.w * c.width)) * 100) / 100;
        setPipAspect((o) => (o === a ? o : a));
      }
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
    if (inkDown(e)) return;
    // escrevendo com a Pencil: toque grande é a palma (ignora); o resto só vale em dois dedos
    const strict = writing && pencilSeen.current && e.pointerType === 'touch';
    if (strict && (e.width > 46 || e.height > 46)) return;
    // onde o PDF estava antes do gesto: se era a mão chegando antes da Pencil, volta para cá
    if (!pointers.current.size) viewSnap.current = pdf.current?.pos ?? null;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1 && !strict) {
      const now = Date.now();
      if (now - lastTap.current < 300) pdf.current?.toggleFit();
      lastTap.current = now;
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (inkMove(e)) return;
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
      // escrevendo com a Pencil, um dedo sozinho não move o PDF (palma e toques sem querer): use dois dedos
      if (!(writing && pencilSeen.current && e.pointerType === 'touch')) pdf.current.pan((e.clientX - prev.x) / r.width, (e.clientY - prev.y) / r.height);
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
    if (inkUp(e)) return;
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
    if (cam === 'none' || light) {
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
        // o que a câmera está entregando de verdade (a C922 vai até 1920×1080)
        const read = () => {
          if (cancelled) return;
          const st = t.getSettings();
          if (st.width && st.height) setCamInfo({ w: Math.max(st.width, st.height), h: Math.min(st.width, st.height), fps: Math.round(st.frameRate ?? 0) });
        };
        // quadros adaptativos: pede até 60 fps mantendo a resolução que a câmera já entregou
        const st0 = t.getSettings();
        if (st0.width && st0.height)
          void t
            .applyConstraints({ width: { exact: st0.width }, height: { exact: st0.height }, frameRate: { ideal: 60 } })
            .catch(() => {})
            .finally(read);
        read();
        window.setTimeout(read, 1500);
      })
      .catch(() => toast.error('Não foi possível abrir esta câmera.'));
    return () => {
      cancelled = true;
    };
  }, [cam, res, light]);

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
    if (mic === 'none' || light) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        audio:
          mic === AUTO_MIC
            ? // sem deviceId e sem processamento: o Android escolhe o USB se estiver ligado
              { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } }
            : {
                deviceId: { exact: mic },
                echoCancellation: phoneMic(mics.find((x) => x.deviceId === mic)?.label ?? ''),
                noiseSuppression: phoneMic(mics.find((x) => x.deviceId === mic)?.label ?? ''),
                autoGainControl: phoneMic(mics.find((x) => x.deviceId === mic)?.label ?? ''),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic, mixer, micKick, light]);

  // Silenciar o microfone (a live continua, só sem som)
  useEffect(() => {
    const g = mixer().gain;
    g.gain.setTargetAtTime(muted ? 0 : 1, g.context.currentTime, 0.02);
  }, [muted, mixer]);

  // Medidor do microfone
  useEffect(() => {
    if (light) return;
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
  }, [light]);

  // Situação da live em todos os aparelhos (a cada 1,5 s): quem transmite e qual a cena
  const applyRef = useRef<(r: NonNullable<StudioPoll>) => Promise<void>>(async () => {});
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const rep = reportRef.current();
      const extra = { needPreview: needPreview.current, preview: pendingPreview.current || undefined };
      pendingPreview.current = '';
      const r = await pollStudio(liveId, device.current.id, rep ?? undefined, extra).catch(() => null);
      if (!alive || !r) return;
      if (r.preview && needPreview.current) setPreviewSrc(r.preview);
      // principal: alguém não recebe a imagem direta → prepara a foto para o próximo envio
      const isStage = caster.current || (r.status === 'live' && r.holder?.fresh ? r.holder.device : r.stage?.present ? r.stage.device : '') === device.current.id;
      if (isStage && r.previewWanted) pendingPreview.current = snapshot();
      setRemote(r);
      setDevices(r.devices);
      inkRefetch.current(r.inkRev);
      if (r.cmd) void onCmd.current(r.cmd);
      const l = link.current;
      if (l) {
        for (const sg of r.signals) await l.handle(sg);
        const holder = r.status === 'live' && r.holder?.fresh ? r.holder.device : '';
        const stage = holder || (r.stage?.present ? r.stage.device : '');
        if (!stage && r.status !== 'live' && !stageClaimed.current) {
          // ninguém é o principal (ou ele fechou o estúdio): este passa a ser
          stageClaimed.current = true;
          void setStage(liveId, device.current).finally(() => window.setTimeout(() => (stageClaimed.current = false), 5000));
        }
        if ((caster.current || stage === device.current.id) && canvasRef.current) {
          // aparelho principal: manda a imagem (a da live) para os outros aparelhos
          l.unwatch();
          mirrorSrc.current ??= canvasRef.current.captureStream(15);
          l.setSource(mirrorSrc.current);
        } else if (stage && stage !== device.current.id && wantMirrorRef.current) {
          // os outros mostram a mesma câmera (espelho leve; o olho na prévia desliga)
          l.setSource(null);
          void l.watch(stage);
        } else {
          l.unwatch();
          l.setSource(null);
        }
      }
      // live encerrada em outro aparelho: este para na hora
      if (r.status !== 'live' && caster.current) {
        if (comp.current) comp.current.onFrame = undefined;
        caster.current.abort('A live foi encerrada.');
        caster.current = null;
        setStatus(null);
      }
      await applyRef.current(r);
      sync.current.ready = true;
    };
    void tick();
    const t = window.setInterval(() => void tick(), 1000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [liveId]);

  // Aplica a cena que veio de outro aparelho (câmera ou PDF, PDF e página, câmera no canto, microfone)
  applyRef.current = async (r) => {
    // a live tem uma resolução: quem vai assumir usa a mesma
    if (r.status === 'live' && !caster.current && r.res && r.res !== res) setRes(r.res);
    if (r.rev <= sync.current.rev) return;
    const st = r.state;
    // PDF que outro aparelho acabou de subir: busca a lista nova antes
    if (st.pdfId && !materials.some((m) => m.id === st.pdfId)) {
      router.refresh();
      return;
    }
    sync.current.rev = r.rev;
    await applyScene(st);
  };

  type SceneState = {
    pdfPos?: PdfPos;
    scene?: Scene;
    pdfId?: string;
    page?: number;
    pip?: boolean;
    muted?: boolean;
    mirror?: boolean;
    pipBox?: { x: number; y: number; w: number };
    pipAspect?: number;
  };
  const sceneKey = (x: SceneState) => JSON.stringify([x.scene, x.pdfId, x.page, x.pip, x.muted, x.mirror, x.pipBox, x.pipAspect]);
  const sceneNow = (): SceneState => ({ scene, pdfId, page: pdfView?.page ?? 0, pip, muted, mirror, pipBox, ...(camTrack.current && pipAspect ? { pipAspect } : {}) });
  /** Aplica a cena de outro aparelho (sem mandar de volta). */
  async function applyScene(st: SceneState) {
    if (st.pdfId && !materials.some((m) => m.id === st.pdfId)) return router.refresh();
    sync.current.applying = true;
    try {
      if (st.pdfId && st.pdfId !== pdfId) await openPdf(st.pdfId);
      if (st.scene && st.scene !== scene) setScene(st.scene);
      if (st.page && pdf.current?.pages && st.page !== pdf.current.view.page) await pdf.current.goTo(st.page);
      if (typeof st.pip === 'boolean' && st.pip !== pip) setPip(st.pip);
      if (typeof st.muted === 'boolean' && st.muted !== muted) setMuted(st.muted);
      if (typeof st.mirror === 'boolean' && st.mirror !== mirror) setMirror(st.mirror);
      if (st.pipBox && sceneKey({ pipBox: st.pipBox }) !== sceneKey({ pipBox })) setPipBox(st.pipBox);
      if (st.pdfPos && pdf.current?.pages) pdf.current.setView(st.pdfPos);
      if (st.pipAspect && comp.current && !camTrack.current) {
        comp.current.camAspect = st.pipAspect;
        setPipRect(comp.current.pipRect());
      }
      sync.current.sent = sceneKey({ ...sceneNow(), ...st, page: st.page ?? pdfView?.page ?? 0 });
    } finally {
      window.setTimeout(() => (sync.current.applying = false), 300);
    }
  }

  // Mensagens da ligação direta
  const sendView = useRef<(v: PdfPos) => void>(() => {});
  const lastView = useRef(0);
  const viewTimer = useRef(0);
  const viewDbTimer = useRef(0);
  sendView.current = (v) => {
    if (sync.current.applying) return;
    void v;
    // pelo servidor: quem só controla manda a posição final ~1 s depois; quem transmite também (os outros seguem)
    if (!viewDbTimer.current)
      viewDbTimer.current = window.setTimeout(async () => {
        viewDbTimer.current = 0;
        if (!pdf.current || sync.current.applying) return;
        const r = await setStudioScene(liveId, { pdfPos: pdf.current.pos }).catch(() => null);
        if (r) sync.current.rev = Math.max(sync.current.rev, r.rev);
      }, caster.current ? 1000 : 600);
    if (!link.current?.connected) return;
    // junta os movimentos e manda a posição final a cada 1 s (nos dois sentidos)
    if (viewTimer.current) return;
    viewTimer.current = window.setTimeout(() => {
      viewTimer.current = 0;
      if (pdf.current && !sync.current.applying) link.current?.post({ t: 'pdfv', v: pdf.current.pos });
    }, caster.current ? 1000 : 150);
    lastView.current = performance.now();
  };
  const devicesNow = () => ({
    cams: [...cams.map((c, i) => ({ id: c.deviceId, name: camName(c, i, cams) })), { id: 'none', name: 'Sem câmera' }],
    mics: [...(android ? [{ id: AUTO_MIC, name: AUTO_MIC_NAME }] : []), ...mics.map((m, i) => ({ id: m.deviceId, name: micName(m, i) })), { id: 'none', name: 'Sem microfone' }],
    cam,
    mic,
  });
  onLinkMsg.current = (m) => {
    if (m.t === 'scene') void applyScene(m.s as SceneState);
    else if (m.t === 'pdfv' && pdf.current) pdf.current.setView(m.v as PdfPos);
    else if (m.t === 'devices') setHostDev(m.d as typeof hostDev);
    else if (m.t === 'ink' && m.pdfId === pdfId) ink.current.apply(unpackOps(m.ops as PackedOps));
    else if (m.t === 'laser') ink.current.laserFrom(String(m.id), String(m.color), m.pts as number[]);
    else if (m.t === 'cam' && caster.current) setCam(String(m.id));
    else if (m.t === 'mic' && caster.current) setMic(String(m.id));
  };
  // quem transmite manda o estado completo para o aparelho que acabou de ligar
  onLinkOpen.current = (d) => {
    if (!caster.current || !link.current) return;
    link.current.post({ t: 'scene', s: sceneNow() }, d);
    if (pdf.current?.pages) link.current.post({ t: 'pdfv', v: pdf.current.pos }, d);
    link.current.post({ t: 'devices', d: devicesNow() }, d);
  };
  // câmeras/microfones de quem transmite mudaram: avisa os outros aparelhos
  useEffect(() => {
    if (caster.current) link.current?.post({ t: 'devices', d: devicesNow() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cams, mics, cam, mic, onAir]);

  // Mudou a cena aqui: avisa os outros aparelhos
  useEffect(() => {
    if (sync.current.applying) return;
    const now = sceneNow();
    const key = sceneKey(now);
    // aparelho que acabou de abrir: primeiro recebe a cena da live, não manda a sua (padrão) por cima
    if (!sync.current.ready) {
      sync.current.sent = key;
      return;
    }
    if (key === sync.current.sent) return;
    // direto para os outros aparelhos (na hora) ...
    link.current?.post({ t: 'scene', s: now });
    // ... e guardado no servidor (quem abrir o estúdio depois já vê igual)
    const t = window.setTimeout(async () => {
      if (sync.current.applying) return;
      sync.current.sent = key;
      const r = await setStudioScene(liveId, {
        scene,
        pdfId: pdfId || undefined,
        page: pdfView?.page || undefined,
        pip,
        muted,
        mirror,
        pipBox,
        ...(camTrack.current && pipAspect ? { pipAspect } : {}),
      }).catch(() => null);
      if (r) sync.current.rev = Math.max(sync.current.rev, r.rev);
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, pdfId, pdfView?.page, pip, muted, mirror, pipBox, pipAspect, liveId]);

  // Câmeras e microfones deste aparelho para os outros verem (só quando muda, ou a cada 15 s)
  const reportRef = useRef<() => Omit<StudioDevice, 'device'> | null>(() => null);
  reportRef.current = () => {
    const d = devicesNow();
    const rep = { label: device.current.label, cams: d.cams.filter((c) => c.id !== 'none'), mics: d.mics.filter((m) => m.id !== 'none'), cam, mic };
    const key = JSON.stringify(rep);
    const now = Date.now();
    if (key === reported.current.key && now - reported.current.at < 15_000) return null;
    reported.current = { key, at: now };
    return rep;
  };

  /** Este aparelho assume a live com a câmera escolhida (abre câmera e microfone só agora). */
  async function takeOver(camId?: string) {
    if (caster.current) {
      if (camId) setCam(camId);
      return;
    }
    if (camId) setCam(camId);
    setArmed(true);
    if (!liveOn) {
      // antes da live: este aparelho passa a ser o principal (a câmera dele é a da live)
      await setStage(liveId, device.current).catch(() => null);
      window.setTimeout(() => setArmed(false), 2500);
      return;
    }
    // espera a câmera abrir (até 6 s)
    const t0 = Date.now();
    while (Date.now() - t0 < 6000 && (!camTrack.current || (camId && camTrack.current.getSettings().deviceId !== camId && camId !== 'none'))) await new Promise((r) => setTimeout(r, 150));
    await goLive();
    setArmed(false);
  }

  // Comandos de outros aparelhos
  const onCmd = useRef<(c: { t: string; id?: string }) => Promise<void>>(async () => {});
  onCmd.current = async (c) => {
    if (c.t === 'scan') {
      await refreshDevices(false);
      reported.current.key = '';
    } else if (c.t === 'cam' && caster.current && c.id) setCam(c.id);
    else if (c.t === 'mic' && caster.current && c.id) setMic(c.id);
    else if (c.t === 'take') {
      if (liveOn) toast('Assumindo a live…');
      await takeOver(c.id);
    } else if (c.t === 'start' && !caster.current && !liveOn) await goLive();
  };

  /** Barra de escrita: ferramentas, cor e espessura, desfazer, limpar página e tela cheia */
  async function openWriting() {
    setInkTool('pen');
    setInkPop(null);
    setWriting(true);
    if (!full) await enterFull();
  }
  function closeWriting() {
    setWriting(false);
    setInkTool('hand');
    setInkPop(null);
    ink.current.selected.clear();
    setSelBox(null);
    void exitFull();
  }
  // saiu da tela cheia (gesto do sistema, Esc): o modo escrita fecha junto
  useEffect(() => {
    if (!full && writing) {
      setWriting(false);
      setInkTool('hand');
      setInkPop(null);
      ink.current.selected.clear();
    }
  }, [full, writing]);

  /**
   * Ferramentas do modo escrita, no estilo dos apps de anotação do iPad: uma pílula flutuante no alto,
   * com ferramentas, cores e espessuras à vista (sem menus). Se não couber, rola para o lado.
   */
  function inkBar() {
    const tools: { k: InkTool; label: string; icon: typeof Hand }[] = [
      { k: 'hand', label: 'Mover o PDF', icon: Hand },
      { k: 'pen', label: 'Caneta', icon: PenLine },
      { k: 'marker', label: 'Marca-texto', icon: Highlighter },
      { k: 'shape', label: 'Formas', icon: Shapes },
      { k: 'laser', label: 'Laser', icon: MousePointerClick },
      { k: 'eraser', label: 'Borracha', icon: Eraser },
      { k: 'select', label: 'Selecionar escrita', icon: Lasso },
    ];
    const kinds: { k: ShapeKind; label: string; icon: typeof Hand }[] = [
      { k: 'line', label: 'Reta', icon: Minus },
      { k: 'arrow', label: 'Seta', icon: MoveUpRight },
      { k: 'rect', label: 'Retângulo', icon: Square },
      { k: 'ellipse', label: 'Elipse', icon: Circle },
    ];
    const btn = (on: boolean) =>
      cn('relative grid size-10 shrink-0 place-items-center rounded-full transition', on ? 'bg-white text-black shadow' : 'text-white hover:bg-white/15');
    const sep = <span className="mx-1 h-6 w-px shrink-0 bg-white/20" />;
    const paints = inkTool === 'pen' || inkTool === 'marker' || inkTool === 'shape' || inkTool === 'laser';
    // ferramenta com tamanho ajustável (as formas usam o da caneta)
    const sized: Sized | null = inkTool === 'pen' || inkTool === 'shape' ? 'pen' : inkTool === 'marker' ? 'marker' : inkTool === 'eraser' ? 'eraser' : null;
    const pick = (t: InkTool) => {
      setInkTool(t);
      setInkPop(null);
      if (t !== 'select') {
        ink.current.selected.clear();
        setSelBox(null);
      }
    };
    return (
      <>
      <div
        role="toolbar"
        aria-label="Ferramentas de escrita"
        className="no-scrollbar absolute top-2 left-2 z-30 flex max-w-[calc(100%-13.5rem)] items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-neutral-900/85 p-1 shadow-2xl backdrop-blur-xl max-sm:top-14 max-sm:max-w-[calc(100%-1rem)]"
      >
        {tools.map((t) => (
          <button key={t.k} type="button" onClick={() => pick(t.k)} aria-label={t.label} aria-pressed={inkTool === t.k} title={t.label} className={btn(inkTool === t.k)}>
            <t.icon className="size-[18px]" />
          </button>
        ))}
        {inkTool === 'shape' && (
          <>
            {sep}
            {kinds.map((k) => (
              <button
                key={k.k}
                type="button"
                onClick={() => setShapeKind(k.k)}
                aria-label={k.label}
                aria-pressed={shapeKind === k.k}
                title={k.label}
                className={cn('grid size-9 shrink-0 place-items-center rounded-full text-white transition', shapeKind === k.k ? 'bg-brand' : 'hover:bg-white/15')}
              >
                <k.icon className="size-4" />
              </button>
            ))}
          </>
        )}
        {(paints || sized) && sep}
        {paints && (
          <button
            type="button"
            onClick={() => setInkPop((p) => (p === 'color' ? null : 'color'))}
            aria-label="Cores"
            aria-expanded={inkPop === 'color'}
            title="Cores"
            className={btn(false)}
          >
            <span className="block size-6 rounded-full ring-2 ring-white/80" style={{ background: inkTool === 'laser' ? laserColor : strokeStyle(inkTool === 'marker' ? 'marker' : 'pen').color }} />
          </button>
        )}
        {sized && (
          <button
            type="button"
            onClick={() => setInkPop((p) => (p === 'size' ? null : 'size'))}
            aria-label="Tamanho"
            aria-expanded={inkPop === 'size'}
            title="Tamanho"
            className={cn(btn(false), 'w-auto gap-1.5 px-2.5 text-xs font-bold tabular-nums')}
          >
            <span className="block rounded-full bg-white" style={{ width: 4 + inkW[sized] * 2, height: 4 + inkW[sized] * 2 }} />
            {inkW[sized].toFixed(1).replace('.', ',')}
          </button>
        )}
        {sep}
        <button type="button" onClick={undoInk} aria-label="Desfazer" title="Desfazer" className={btn(false)}>
          <Undo2 className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={async () => {
            if (await confirmDialog('Apagar a escrita desta página?')) clearPage();
          }}
          aria-label="Limpar a página"
          title="Limpar a página"
          className={btn(false)}
        >
          <Trash2 className="size-[18px]" />
        </button>
        <button type="button" onClick={closeWriting} aria-label="Fechar escrita" title="Fechar escrita" className={cn(btn(false), 'bg-white/10')}>
          <X className="size-[18px]" />
        </button>
      </div>
      {inkPop === 'color' && paints && (
        <div className="absolute top-16 left-2 z-40 flex animate-scale-in gap-1.5 rounded-full border border-white/10 bg-neutral-900/90 p-1.5 shadow-2xl backdrop-blur-xl max-sm:top-28">
          {INK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setInkColor(c);
                setInkPop(null);
              }}
              aria-label={`Cor ${c}`}
              aria-pressed={inkColor === c}
              className="grid size-9 place-items-center rounded-full"
            >
              <span className={cn('block rounded-full transition-all', inkColor === c ? 'size-7 ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : 'size-6 ring-1 ring-white/30')} style={{ background: c }} />
            </button>
          ))}
        </div>
      )}
      {inkPop === 'size' && sized && (
        <div className="absolute top-16 left-2 z-40 flex w-72 max-w-[calc(100%-1rem)] animate-scale-in items-center gap-3 rounded-full border border-white/10 bg-neutral-900/90 px-4 py-2.5 text-white shadow-2xl backdrop-blur-xl max-sm:top-28">
          <span className="block size-1.5 shrink-0 rounded-full bg-white" />
          <input
            type="range"
            min={0.1}
            max={7}
            step={0.1}
            value={inkW[sized]}
            onChange={(e) => setSize(sized, Number(e.target.value))}
            aria-label={sized === 'eraser' ? 'Tamanho da borracha' : sized === 'marker' ? 'Tamanho do marca-texto' : 'Tamanho da caneta'}
            className="h-8 min-w-0 flex-1 accent-white"
          />
          <span className="block size-4 shrink-0 rounded-full bg-white" />
          <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums">{inkW[sized].toFixed(1).replace('.', ',')}</span>
        </div>
      )}
      </>
    );
  }

  /** Escolheu uma câmera na lista de todos os aparelhos: troca nele ou passa a live para ele. */
  async function pickAnyCam(v: string) {
    const [dev, id] = v.split('|');
    if (dev === device.current.id) {
      if (onAir || !stageDev || stageDev === device.current.id) setCam(id);
      else await takeOver(id);
      return;
    }
    if (dev === stageDev) await studioCommand(liveId, dev, { t: 'cam', id });
    else {
      await studioCommand(liveId, dev, { t: 'take', id });
      toast(`${liveOn ? 'Passando a live para o' : 'Câmera do'} ${devices.find((d) => d.device === dev)?.label ?? 'outro aparelho'}…`);
    }
  }
  /** o aparelho principal (outro aparelho): a câmera e o microfone em uso são os dele */
  const holderDev = light ? (devices.find((d) => d.device === stageDev) ?? null) : null;
  const tag = (dev: string) => (dev !== stageDev ? '' : liveOn ? ' · no ar' : ' · em uso');
  const camGroups = [
    {
      device: device.current.id,
      label: `${device.current.label || 'Este aparelho'}${onAir || stageDev === device.current.id || !stageDev ? tag(device.current.id) || (devices.length > 1 ? ' · em uso' : '') : ' · este'}`,
      cams: cams.map((c, i) => ({ id: c.deviceId, name: camName(c, i, cams) })),
    },
    ...devices
      .filter((d) => d.device !== device.current.id && d.cams.length)
      .map((d) => ({ device: d.device, label: `${d.label}${tag(d.device)}`, cams: d.cams })),
  ];
  const camValue = holderDev ? `${holderDev.device}|${holderDev.cam}` : `${device.current.id}|${cam}`;
  async function scanAll() {
    setScanning(true);
    await refreshDevices(false);
    reported.current.key = '';
    await studioScan(liveId).catch(() => null);
    window.setTimeout(() => setScanning(false), 2500);
  }

  // ---------------- escrita: enviar, receber, desfazer
  /** junta mudanças para mandar de uma vez (ao servidor, a cada ~0,6 s) */
  function queueInk(ops: InkOps) {
    const q = inkQueue.current;
    const adds = new Map((q.add ?? []).map((x) => [x.id, x]));
    for (const id of ops.remove ?? []) adds.delete(id);
    for (const x of ops.add ?? []) adds.set(x.id, x);
    inkQueue.current = { add: [...adds.values()], remove: [...new Set([...(q.remove ?? []), ...(ops.remove ?? [])])] };
    if (!inkTimer.current)
      inkTimer.current = window.setTimeout(async () => {
        inkTimer.current = 0;
        const send = inkQueue.current;
        inkQueue.current = {};
        if (!pdfId || (!send.add?.length && !send.remove?.length)) return;
        const r = await inkOps(liveId, pdfId, packOps(send)).catch(() => null);
        // a versão nova é a nossa: não precisa buscar de volta
        if (r && 'rev' in r && r.rev && r.rev === inkRevSeen.current + 1) inkRevSeen.current = r.rev;
      }, caster.current ? 800 : 500);
  }
  /** mudança feita aqui: guarda para desfazer, manda para os outros aparelhos */
  function commitInk(ops: InkOps | null, before: Stroke[]) {
    if (!ops || (!ops.add?.length && !ops.remove?.length)) return;
    undoStack.current.push(ink.current.invert(ops, before));
    if (undoStack.current.length > 60) undoStack.current.shift();
    // quem transmite manda na hora para quem controla (o servidor guarda logo depois)
    if (caster.current || !light) link.current?.post({ t: 'ink', pdfId, ops: packOps(ops) });
    queueInk(ops);
  }
  function undoInk() {
    const inv = undoStack.current.pop();
    if (!inv) return;
    ink.current.apply(inv);
    if (caster.current || !light) link.current?.post({ t: 'ink', pdfId, ops: packOps(inv) });
    queueInk(inv);
  }
  function clearPage() {
    if (!pdf.current?.pages) return;
    const r = pdf.current.pageRange(pdf.current.page);
    const ids = ink.current.idsInRange(r.top, r.bottom);
    if (!ids.length) return;
    const before = [...ink.current.strokes];
    const ops = { remove: ids };
    ink.current.apply(ops);
    commitInk(ops, before);
  }
  // escrita do PDF aberto (ao abrir o estúdio ou trocar de PDF)
  useEffect(() => {
    ink.current.strokes = [];
    ink.current.selected.clear();
    undoStack.current = [];
    setSelBox(null);
    if (!pdfId) return;
    let off = false;
    void getInk(liveId, pdfId).then((r) => {
      if (off) return;
      ink.current.strokes = r.strokes.map(unpackStroke).filter((x): x is Stroke => Boolean(x));
    });
    return () => {
      off = true;
    };
  }, [pdfId, liveId]);
  // escrita feita em outro aparelho (pelo servidor)
  const inkRefetch = useRef<(rev: number) => void>(() => {});
  inkRefetch.current = (rev) => {
    if (!pdfId || rev === inkRevSeen.current) return;
    const first = inkRevSeen.current < 0;
    inkRevSeen.current = rev;
    if (first) return;
    void getInk(liveId, pdfId).then((r) => {
      const keep = ink.current.current;
      ink.current.strokes = r.strokes.map(unpackStroke).filter((x): x is Stroke => Boolean(x));
      // o que ainda não foi enviado daqui continua
      ink.current.apply(inkQueue.current);
      ink.current.current = keep;
    });
  };
  // quem só controla desenha a prévia rápido enquanto escreve (senão fica a 4 quadros)
  useEffect(() => {
    if (light && !onAir) comp.current?.setFps(inkTool !== 'hand' ? 24 : 4);
  }, [inkTool, light, onAir]);
  // caixa da seleção acompanha zoom e rolagem
  useEffect(() => {
    if (inkTool !== 'select') return setSelBox(null);
    const t = window.setInterval(() => {
      const b = ink.current.selectionBox();
      const p = pdf.current;
      if (!b || !p?.pages) return setSelBox((o) => (o ? null : o));
      const a = p.toFrame(b.x0, b.y0);
      const c = p.toFrame(b.x1, b.y1);
      const nb = { x: a.fx, y: a.fy, w: c.fx - a.fx, h: c.fy - a.fy };
      setSelBox((o) => (o && Math.abs(o.x - nb.x) + Math.abs(o.y - nb.y) + Math.abs(o.w - nb.w) < 0.001 ? o : nb));
    }, 80);
    return () => window.clearInterval(t);
  }, [inkTool]);

  /**
   * Palma da mão no iPad: enquanto a Pencil escreve, o toque da mão em qualquer lugar da página não
   * seleciona texto, não rola e não aperta botões. No PDF, nenhum toque abre a lupa/seleção do Safari.
   */
  useEffect(() => {
    if (!writing) return;
    // a mão encostando não seleciona texto nem abre a lupa em lugar nenhum da página
    const st = document.documentElement.style as CSSStyleDeclaration & { webkitUserSelect: string; webkitTouchCallout: string };
    const prev = [st.userSelect, st.webkitUserSelect, st.webkitTouchCallout];
    st.userSelect = 'none';
    st.webkitUserSelect = 'none';
    st.webkitTouchCallout = 'none';
    window.getSelection()?.removeAllRanges();
    const finger = (t: Touch) => (t as Touch & { touchType?: string }).touchType !== 'stylus';
    const onTouch = (e: TouchEvent) => {
      const onCanvas = e.target === canvasRef.current;
      if (!e.cancelable) return;
      if (onCanvas && scene === 'pdf') e.preventDefault();
      else if (pencilSeen.current && penBusy() && [...e.changedTouches].some(finger)) e.preventDefault();
    };
    // o clique vem depois do toque: lembra se foi a mão (a Pencil continua apertando botões)
    let palmDown = false;
    const onDown = (e: PointerEvent) => {
      palmDown = e.pointerType === 'touch' && pencilSeen.current && penBusy();
      if (palmDown && e.target !== canvasRef.current) e.stopPropagation();
    };
    const onClick = (e: MouseEvent) => {
      if (palmDown) {
        palmDown = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('touchstart', onTouch, { capture: true, passive: false });
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('click', onClick, true);
    return () => {
      [st.userSelect, st.webkitUserSelect, st.webkitTouchCallout] = prev;
      document.removeEventListener('touchstart', onTouch, { capture: true });
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('click', onClick, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing, scene]);

  /** cor e espessura de cada ferramenta */
  const strokeStyle = (tool: 'pen' | 'marker') => ({
    color: tool === 'marker' && inkColor === '#111111' ? '#facc15' : inkColor,
    size: inkW[tool] * INK_UNIT[tool],
  });
  const laserColor = inkColor === '#111111' ? '#ef4444' : inkColor;
  const laserSent = useRef(0);

  /**
   * Camada rápida: o traço que está sendo escrito aparece aqui na hora (a cada quadro da tela, 60/120 Hz),
   * sem esperar o próximo quadro da transmissão. A live recebe o mesmo traço no quadro seguinte.
   */
  const fastRef = useRef<HTMLCanvasElement>(null);
  const fastRaf = useRef(0);
  const fastClear = useRef(0);
  /** pontos que o navegador prevê (só na camada rápida: tira a sensação de atraso) */
  const predicted = useRef<number[]>([]);
  /** área do quadro dentro do elemento (o canvas fica centralizado, sem distorcer) */
  const frameRect = (el: HTMLCanvasElement) => {
    const r = el.getBoundingClientRect();
    const s = Math.min(r.width / el.width, r.height / el.height) || 1;
    const w = el.width * s;
    const h = el.height * s;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h, ox: (r.width - w) / 2, oy: (r.height - h) / 2, r };
  };
  /** pressão da Apple Pencil → espessura (o toque leve ainda deixa tinta) */
  const penPressure = (e: PointerEvent | React.PointerEvent) => (e.pointerType === 'pen' && e.pressure > 0 ? Math.min(1, 0.1 + 0.9 * Math.pow(e.pressure, 0.75)) : undefined);
  function drawFast() {
    fastRaf.current = 0;
    const c = fastRef.current;
    const el = canvasRef.current;
    const p = pdf.current;
    if (!c || !el || !p) return;
    const f = frameRect(el);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.round(f.r.width * dpr);
    const H = Math.round(f.r.height * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const view = { x: f.ox * dpr, y: f.oy * dpr, k: (f.width * dpr) / p.viewWidth, cx: p.cx, cy: p.cy };
    const L = lasso.current;
    if (L && L.length >= 4) {
      // laço da seleção: traço livre tracejado
      ctx.save();
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = '#2563eb';
      ctx.fillStyle = 'rgba(37,99,235,0.08)';
      ctx.beginPath();
      for (let i = 0; i < L.length; i += 2) {
        const x = view.x + (L[i] - view.cx) * view.k;
        const y = view.y + (L[i + 1] - view.cy) * view.k;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    const cur = ink.current.current;
    // marca-texto é transparente: desenhado duas vezes ficaria mais escuro, então fica só na prévia normal
    if (!cur || cur.tool !== 'pen') return;
    const s = predicted.current.length ? { ...cur, pts: cur.pts.concat(predicted.current), pr: cur.pr && cur.pr.concat(predicted.current.filter((_, i) => i % 2 === 0).map(() => cur.pr![cur.pr!.length - 1])) } : cur;
    const k = (f.width * dpr) / p.viewWidth;
    ink.current.drawStroke(ctx, s, { x: f.ox * dpr, y: f.oy * dpr, k, cx: p.cx, cy: p.cy, w: f.width * dpr, h: f.height * dpr }, true);
  }
  const fastDraw = () => {
    window.clearTimeout(fastClear.current);
    if (!fastRaf.current) fastRaf.current = requestAnimationFrame(drawFast);
  };
  /** fim do traço: a prévia normal já tem o traço inteiro, a camada rápida some */
  const fastDone = () => {
    predicted.current = [];
    // quem só controla redesenha na hora; quem transmite mostra no próximo quadro
    if (light && !onAir) {
      comp.current?.draw();
      if (inkTool === 'hand') comp.current?.setFps(4);
    }
    window.clearTimeout(fastClear.current);
    fastClear.current = window.setTimeout(fastDraw, light && !onAir ? 0 : 90);
  };
  useEffect(() => () => cancelAnimationFrame(fastRaf.current), []);

  /** toque/caneta no PDF com uma ferramenta de escrita. Devolve true se tratou o evento. */
  function inkDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!writing || scene !== 'pdf' || !pdf.current?.pages) return false;
    if (e.pointerType === 'pen') {
      if (!pencilSeen.current)
        try {
          localStorage.setItem('studio-pencil', '1');
        } catch {}
      pencilSeen.current = true;
      lastPen.current = performance.now();
      // mão que encostou antes da caneta: não é gesto (não impede a escrita, e o que ela mexeu no PDF volta)
      if (pointers.current.size && viewSnap.current) pdf.current.restore(viewSnap.current);
      pointers.current.clear();
      // traço anterior que ficou sem o "soltar" (o Safari perdeu o evento): fecha e começa outro
      const old = inkPtr.current;
      if (old) {
        inkPtr.current = null;
        if (old.type !== 'pen') {
          // estava "escrevendo" com a mão encostada antes da Pencil: era a palma, descarta
          ink.current.cancel();
          lasso.current = null;
          fastDone();
        } else if (old.tool === 'pen' || old.tool === 'marker' || old.tool === 'shape') {
          commitInk(ink.current.end(), old.before ?? []);
          fastDone();
        }
      }
    } else if (e.pointerType === 'touch' && pencilSeen.current) {
      // com a Pencil: mão enquanto escreve é a palma (ignora); fora disso, dedos movem/dão zoom
      return penBusy();
    }
    // com a Apple Pencil: a caneta escreve e os dedos movem/dão zoom
    const tool: InkTool = e.pointerType === 'pen' && inkTool === 'hand' ? 'pen' : inkTool;
    if (tool === 'hand') return false;
    if (inkPtr.current) {
      // segundo dedo: deixa de escrever e vira pinça/rolagem
      if (inkPtr.current.type === 'pen') return true; // palma da mão encostando: ignora
      ink.current.cancel();
      inkPtr.current = null;
      fastDone();
      return false;
    }
    if (pointers.current.size) return false;
    const r = frameRect(e.currentTarget);
    const d = pdf.current.toDoc((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    e.currentTarget.setPointerCapture(e.pointerId);
    const st: InkPtr = { id: e.pointerId, type: e.pointerType, tool, before: [...ink.current.strokes] };
    if (tool === 'pen' || tool === 'marker') {
      const k = strokeStyle(tool);
      ink.current.begin(tool, k.color, k.size, d.x, d.y, tool === 'pen' ? penPressure(e) : undefined);
      // quem só controla: prévia rápida enquanto escreve (mesmo com a ferramenta "mover" e a Pencil)
      if (light && !onAir) comp.current?.setFps(24);
      fastDraw();
    } else if (tool === 'shape') {
      st.from = d;
      ink.current.beginShape(strokeStyle('pen').color, strokeStyle('pen').size, d.x, d.y);
      if (light && !onAir) comp.current?.setFps(24);
      fastDraw();
    } else if (tool === 'laser') {
      st.laser = newStrokeId();
      ink.current.laser(st.laser, laserColor, d.x, d.y);
    } else if (tool === 'eraser') {
      st.erased = ink.current.erase(d.x, d.y, inkW.eraser * INK_UNIT.eraser * pdf.current.viewWidth);
    } else if (tool === 'select') {
      st.lasso = [d.x, d.y];
      lasso.current = st.lasso;
      ink.current.selected.clear();
      setSelBox(null);
      fastDraw();
    }
    inkPtr.current = st;
    if (viewing) touched();
    return true;
  }
  function inkMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'pen') lastPen.current = performance.now();
    const st = inkPtr.current;
    if (!st || st.id !== e.pointerId || !pdf.current) return Boolean(st && e.pointerType === 'touch' && st.type === 'pen');
    const r = frameRect(e.currentTarget);
    // a caneta manda vários pontos por quadro: usa todos (traço liso)
    const evs = (e.nativeEvent.getCoalescedEvents?.() ?? []).length ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    for (const ev of evs) {
      const d = pdf.current.toDoc((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
      if (st.tool === 'pen' || st.tool === 'marker') ink.current.extend(d.x, d.y, st.tool === 'pen' ? penPressure(ev) : undefined);
      else if (st.tool === 'shape' && st.from) ink.current.setShape(shapePoints(shapeKind, st.from.x, st.from.y, d.x, d.y));
      else if (st.tool === 'laser' && st.laser) ink.current.laser(st.laser, laserColor, d.x, d.y);
      else if (st.tool === 'eraser') st.erased!.push(...ink.current.erase(d.x, d.y, inkW.eraser * INK_UNIT.eraser * pdf.current.viewWidth));
      else if (st.tool === 'select' && st.lasso) st.lasso.push(d.x, d.y);
    }
    if (st.tool === 'select' || st.tool === 'shape') fastDraw();
    if (st.tool === 'pen') {
      // onde a caneta vai estar no próximo quadro (Chrome/Android); o Safari não prevê
      const pr = e.nativeEvent.getPredictedEvents?.() ?? [];
      predicted.current = pr.slice(0, 2).flatMap((ev) => {
        const d = pdf.current!.toDoc((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
        return [d.x, d.y];
      });
      fastDraw();
    }
    // laser: quem transmite manda para quem controla (e vice-versa), ~8 vezes por segundo
    if (st.tool === 'laser' && st.laser && performance.now() - laserSent.current > 120) {
      laserSent.current = performance.now();
      const l = ink.current.lasers.get(st.laser);
      if (l) link.current?.post({ t: 'laser', id: st.laser, color: l.color, pts: l.pts.flatMap((q) => [q.x, q.y]) });
    }
    if (viewing) touched();
    return true;
  }
  function inkUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'pen') lastPen.current = performance.now();
    const st = inkPtr.current;
    if (!st || st.id !== e.pointerId) return false;
    inkPtr.current = null;
    if (st.tool === 'shape') {
      // toque sem arrastar não vira forma
      const c = ink.current.current;
      const tiny = !c || Math.hypot(c.pts[c.pts.length - 2] - c.pts[0], c.pts[c.pts.length - 1] - c.pts[1]) < 0.004;
      if (tiny && shapeKind !== 'ellipse' && shapeKind !== 'rect') ink.current.cancel();
      else if (c && (shapeKind === 'rect' || shapeKind === 'ellipse') && Math.max(...c.pts.filter((_, i) => i % 2 === 0)) - Math.min(...c.pts.filter((_, i) => i % 2 === 0)) < 0.004)
        ink.current.cancel();
      else commitInk(ink.current.end(), st.before ?? []);
      fastDone();
    } else if (st.tool === 'pen' || st.tool === 'marker') {
      commitInk(ink.current.end(), st.before ?? []);
      fastDone();
    } else if (st.tool === 'eraser' && st.erased?.length) commitInk({ remove: st.erased }, st.before ?? []);
    else if (st.tool === 'select' && st.lasso) {
      ink.current.selectLasso(st.lasso);
      lasso.current = null;
      fastDraw();
    } else if (st.tool === 'laser' && st.laser) {
      const l = ink.current.lasers.get(st.laser);
      if (l) link.current?.post({ t: 'laser', id: st.laser, color: l.color, pts: l.pts.flatMap((q) => [q.x, q.y]) });
    }
    return true;
  }
  // mover/aumentar o que foi selecionado
  const selDown = (e: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'size') => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const b = ink.current.selectionBox();
    if (!b) return;
    selDrag.current = { mode, sx: e.clientX, sy: e.clientY, before: [...ink.current.strokes], last: { dx: 0, dy: 0, s: 1 }, box: { x0: b.x0, y0: b.y0, w: b.x1 - b.x0 } };
  };
  const selMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = selDrag.current;
    const p = pdf.current;
    const c = canvasRef.current;
    if (!d || !p || !c) return;
    const r = c.getBoundingClientRect();
    const dx = ((e.clientX - d.sx) / r.width) * p.viewWidth;
    const dy = ((e.clientY - d.sy) / r.width) * p.viewWidth;
    if (d.mode === 'move') {
      ink.current.transform(dx - d.last.dx, dy - d.last.dy);
      d.last = { ...d.last, dx, dy };
    } else {
      const sc = Math.max(0.2, (d.box.w + dx) / d.box.w);
      ink.current.transform(0, 0, sc / d.last.s, d.box.x0, d.box.y0);
      d.last = { ...d.last, s: sc };
    }
  };
  /** apaga o que está selecionado */
  const deleteSel = () => {
    const ids = [...ink.current.selected];
    if (!ids.length) return;
    const before = [...ink.current.strokes];
    const ops = { remove: ids };
    ink.current.apply(ops);
    ink.current.selected.clear();
    setSelBox(null);
    commitInk(ops, before);
  };
  const selUp = () => {
    const d = selDrag.current;
    selDrag.current = null;
    if (!d) return;
    const moved = ink.current.strokes.filter((x) => ink.current.selected.has(x.id));
    commitInk({ remove: moved.map((x) => x.id), add: moved }, d.before);
  };

  // Assumir sozinho: o aparelho da live parou de enviar (caiu a internet, fechou o app) e este está pronto
  const autoTried = useRef('');
  useEffect(() => {
    if (!autoTake || onAir || busy || !remote || remote.status !== 'live' || !remote.holder || remote.holder.fresh) return;
    if (remote.holder.device === device.current.id && caster.current) return;
    const key = `${remote.holder.device}-${remote.rev}`;
    if (autoTried.current === key) return;
    autoTried.current = key;
    toast('Assumindo a live…');
    void takeOver();
  });

  // Avisa antes de fechar a página no meio da live
  useEffect(() => {
    if (!onAir) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [onAir]);

  async function goLive() {
    if (!camTrack.current && !screenTrack.current) return toast.error('Escolha a câmera ou espelhe a tela.');
    if (caster.current) return;
    setBusy(true);
    try {
      // live já no ar (em outro aparelho): este assume a MESMA transmissão, sem criar outra no YouTube
      let lease = '';
      let resume: ResumeState | null = null;
      const c = await claimStudio(liveId, device.current);
      if (c.error) return void toast.error(c.error);
      if (c.lease) {
        lease = c.lease;
        resume = c.resume ?? null;
      } else {
        const r = await startStudio(liveId, device.current);
        if (r.error) return void toast.error(r.error);
        lease = r.lease ?? '';
      }
      const m = mixer();
      // iPad/iPhone sem toque na tela (troca pedida por outro aparelho): não trava esperando o som liberar
      await Promise.race([m.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
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
        lease,
        resume,
        res,
        // quadros adaptativos: de 22 a 54 por segundo, conforme o aparelho e a internet aguentam
        minFps: 22,
        maxFps: 54,
        onFps: (f) => {
          comp.current?.setFps(f);
          // aparelho apertado: o espelho para os outros aparelhos fica no mínimo
          link.current?.setLevel(f < 30 ? 'low' : 'normal');
        },
        onHandoff: () => {
          if (comp.current) {
            comp.current.onFrame = undefined;
            comp.current.setFps(30);
          }
          caster.current = null;
          setStatus(null);
          toast('A transmissão passou para outro aparelho.');
          router.refresh();
        },
      });
      caster.current = b;
      await b.start();
      if (comp.current) {
        comp.current.setFps(30);
        comp.current.onFrame = (c) => b.pushFrame(c);
      }
      void setStudioScene(liveId, { res, scene, pdfId: pdfId || undefined, page: pdfView?.page, pip, muted });
      toast(resume ? 'Transmitindo deste aparelho' : 'Transmissão iniciada');
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
      if (comp.current) {
        comp.current.onFrame = undefined;
        comp.current.setFps(30);
      }
      await caster.current?.stop();
      caster.current = null;
      setStatus(null);
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
    <div
      className={cn(
        'grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]',
      )}
    >
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
                onPointerDown={(e) => {
                  if (viewing) touched();
                  onDown(e);
                }}
                onPointerMove={(e) => {
                  if (viewing && e.buttons) touched();
                  onMove(e);
                }}
                onWheel={() => viewing && touched()}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                className={cn(
                  'size-full object-contain',
                  (scene === 'pdf' || (scene === 'camera' && fit === 'cover')) && 'cursor-grab touch-none active:cursor-grabbing',
                )}
                data-zoom={pdfView?.zoom.toFixed(2)}
                aria-label="Prévia da transmissão"
              />
              <canvas ref={fastRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
              {/* seleção da escrita: arrastar move, alça muda o tamanho (não aparece na live) */}
              {scene === 'pdf' && inkTool === 'select' && selBox && (
                <div
                  role="button"
                  aria-label="Mover o que foi selecionado"
                  onPointerDown={(e) => selDown(e, 'move')}
                  onPointerMove={selMove}
                  onPointerUp={selUp}
                  onPointerCancel={selUp}
                  className="absolute z-10 cursor-move touch-none border-2 border-dashed border-brand"
                  style={{ left: `${selBox.x * 100}%`, top: `${selBox.y * 100}%`, width: `${selBox.w * 100}%`, height: `${selBox.h * 100}%` }}
                >
                  <div
                    role="button"
                    aria-label="Mudar o tamanho do que foi selecionado"
                    onPointerDown={(e) => selDown(e, 'size')}
                    onPointerMove={selMove}
                    onPointerUp={selUp}
                    onPointerCancel={selUp}
                    className="absolute -right-3 -bottom-3 grid size-7 cursor-nwse-resize touch-none place-items-center rounded-full border-2 border-white bg-brand shadow"
                  >
                    <Maximize2 className="size-3.5 text-white" />
                  </div>
                  <button
                    type="button"
                    aria-label="Excluir seleção"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={deleteSel}
                    className="absolute -top-11 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full bg-red-600 text-white shadow-lg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
              {/* reserva: foto da imagem da live (1 por segundo) quando a ligação direta não conecta */}
              {light && !mirrorOk && previewSrc && !touching && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewSrc} alt="Imagem da live" className="pointer-events-none absolute inset-0 size-full bg-black object-contain" />
              )}
              {/* aparelho que só controla: mostra a imagem real da live (câmera de quem transmite) */}
              <video
                ref={mirrorVideo}
                autoPlay
                playsInline
                muted
                aria-label="Imagem da live"
                className={cn('pointer-events-none absolute inset-0 size-full bg-black object-contain', (!viewing || touching) && 'hidden', viewing && !mirrorOk && previewSrc && 'opacity-0')}
              />
              {/* Quadradinho da câmera: arraste para qualquer lugar; toque para mudar o tamanho (não aparece na live) */}
              {(scene === 'both' || (scene === 'pdf' && pip)) && (camTrack.current || light) && (
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
                      // aparelho que só controla: contorno para ver onde está a câmera do principal
                      light && !pipSel && 'ring-1 ring-white/60',
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
            {onAir && soundLocked && (
              <button
                type="button"
                onClick={() => void audio.current?.ctx.resume()}
                className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-black"
              >
                Toque para ativar o som
              </button>
            )}
            {light && !liveOn && stageLabel && (
              <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] font-bold text-white">
                <Camera className="size-3" /> {stageLabel}
              </span>
            )}
            {!onAir && liveOn && remote?.holder && (
              <span
                className={cn(
                  'absolute top-3 left-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold text-white',
                  remote.holder.fresh ? 'bg-red-600' : 'bg-black/70',
                )}
              >
                <span className={cn('size-1.5 rounded-full bg-white', remote.holder.fresh && 'animate-pulse')} />
                {remote.holder.fresh ? `AO VIVO · ${remote.holder.label}` : `${remote.holder.label} sem sinal`}
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
                        ...(android ? [{ id: AUTO_MIC, name: AUTO_MIC_NAME }] : []),
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

            {/* escrita na tela cheia: barra na lateral */}
            {full && writing && scene === 'pdf' && !!pdfView?.pages && inkBar()}
            {full && !writing && canInk && scene === 'pdf' && !!pdfView?.pages && (
              <button
                type="button"
                onClick={() => void openWriting()}
                aria-label="Escrever"
                className="absolute top-1/2 left-2 z-30 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/75 text-white backdrop-blur"
              >
                <PenLine className="size-5" />
              </button>
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
                    onClick={() => void (liveOn ? takeOver() : goLive())}
                    disabled={busy || blocked}
                    className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busy ? <Spinner /> : <Radio className="size-4" />} {liveOn ? 'Assumir' : 'Iniciar'}
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
            <aside
              aria-label="Chat da live"
              className="absolute top-14 right-2 bottom-2 z-40 w-[min(340px,calc(100%-1rem))] animate-scale-in overflow-hidden rounded-2xl border border-white/15 bg-surface shadow-2xl"
            >
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

        {scene === 'pdf' && canInk && !!pdfView?.pages && !full && (
          <button type="button" onClick={() => void openWriting()} className={buttonClass('secondary', 'md', 'mx-auto flex w-fit')}>
            <PenLine className="size-4" /> Escrever
          </button>
        )}

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
              <p data-target={status?.target} className={cn('font-bold tabular-nums', (status?.lost ?? 0) >= 15 ? 'text-warning' : 'text-ink')}>{status?.fps ?? 0} fps</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="flex items-center justify-center gap-1 text-muted">
                <Wifi className="size-3" /> Fila
              </p>
              <p className={cn('font-bold tabular-nums', (status?.queue ?? 0) > 2 ? 'text-warning' : 'text-ink')}>{status?.queue ?? 0}</p>
            </div>
          </div>
        ) : null}
        {onAir && (status?.lost ?? 0) >= 15 && (
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
        ) : liveOn ? (
          // live no ar em outro aparelho: este assume a mesma live (ou encerra para todos)
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onClick={() => void takeOver()} disabled={busy || blocked} className={buttonClass('primary', 'lg', 'w-full !bg-red-600 hover:!bg-red-700')}>
              {busy ? <Spinner /> : <Radio className="size-4" />} Transmitir deste aparelho
            </button>
            <button type="button" onClick={() => void endLive()} disabled={busy} className={buttonClass('secondary', 'lg')} aria-label="Encerrar a live">
              <CircleStop className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              // a live começa no aparelho principal (o da câmera em uso)
              if (light && stageDev) {
                void studioCommand(liveId, stageDev, { t: 'start' });
                toast(`Iniciando no ${stageLabel || 'outro aparelho'}…`);
              } else void goLive();
            }}
            disabled={busy || (!light && blocked)}
            className={buttonClass('primary', 'lg', 'w-full !bg-red-600 hover:!bg-red-700')}
          >
            {busy ? <Spinner /> : <Radio className="size-4" />} Iniciar transmissão
          </button>
        )}
        {liveOn && (
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input
              type="checkbox"
              checked={autoTake}
              onChange={(e) => {
                setAutoTake(e.target.checked);
                try {
                  localStorage.setItem('studio-auto', e.target.checked ? '1' : '0');
                } catch {}
              }}
              className="size-4 accent-red-600"
            />
            Assumir se o outro aparelho cair
          </label>
        )}
        <p className="text-xs text-muted">{support && !support.ok ? support.reason : permError || hint}</p>
        <div className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Camera className="size-3.5" /> Câmera
            {/* lê de novo as câmeras de todos os aparelhos abertos no estúdio */}
            <button
              type="button"
              onClick={() => void scanAll()}
              disabled={scanning}
              className="ml-auto flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-brand disabled:opacity-60"
            >
              <RefreshCw className={cn('size-3', scanning && 'animate-spin')} /> Atualizar
            </button>
          </span>
          {/* câmeras de todos os aparelhos: escolher a de outro aparelho passa a live para ele */}
          <Select value={camValue} onChange={(e) => void pickAnyCam(e.target.value)} aria-label="Câmera">
            {camGroups.map((g) => (
              <optgroup key={g.device} label={g.label}>
                {g.cams.map((c) => (
                  <option key={c.id} value={`${g.device}|${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={`${device.current.id}|none`}>Sem câmera</option>
          </Select>
          {!light && cam !== 'none' && camInfo && (
            <span className={cn('block text-[11px]', camInfo.h < RES[res].h ? 'text-warning' : 'text-muted')}>
              Câmera entregando {camInfo.w}×{camInfo.h}
              {camInfo.fps ? ` · ${camInfo.fps} fps` : ''}
              {camInfo.h < RES[res].h ? ` — abaixo de ${res}p, a imagem não ganha detalhe` : ''}
            </span>
          )}
        </div>
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
            {light && holderDev ? (
              <Select
                value={holderDev.mic}
                onChange={(e) => void studioCommand(liveId, holderDev.device, { t: 'mic', id: e.target.value })}
                aria-label="Microfone"
                className="min-w-0 flex-1"
              >
                <optgroup label={holderDev.label}>
                  {holderDev.mics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            ) : (
              <Select value={mic} onChange={(e) => setMic(e.target.value)} aria-label="Microfone" className="min-w-0 flex-1">
                {android && <option value={AUTO_MIC}>{AUTO_MIC_NAME}</option>}
                {mics.map((m, i) => (
                  <option key={m.deviceId || i} value={m.deviceId}>
                    {micName(m, i)}
                  </option>
                ))}
                <option value="none">Sem microfone</option>
              </Select>
            )}
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
          {mic === AUTO_MIC && (
            <p className="text-[11px] text-muted">Ligue o receptor USB e toque em ↻. Fale no microfone externo: a barra verde deve mexer.</p>
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
          <Select value={res} onChange={(e) => pickRes(e.target.value as Res)} disabled={onAir || liveOn} aria-label="Resolução">
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
