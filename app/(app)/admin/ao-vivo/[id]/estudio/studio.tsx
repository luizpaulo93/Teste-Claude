'use client';

import {
  AppWindow,
  RefreshCw,
  MessageSquare,
  Maximize2,
  Minimize2,
  Camera,
  ChevronsLeft,
  ChevronsRight,
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
import { claimStudio, pollStudio, rtcSend, setStudioScene, startStudio, stopStudio, setStage, studioCommand, studioScan, type StudioDevice } from '../../../live-actions';
import { StudioLink, type LinkMsg } from '@/lib/live/studio-link';
import { confirmDialog } from '@/components/confirm';
import { toast } from '@/components/toast';
import { buttonClass, Select } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { Broadcaster, checkSupport, type BroadcastStatus, type ResumeState } from '@/lib/live/broadcaster';
import { Compositor, type Fit, type Scene } from '@/lib/live/compositor';
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

/** a situação da live mudou em algo que a tela usa? (a consulta é a cada segundo; refazer o estúdio à toa trava a caneta) */
const sameRemote = (a: NonNullable<StudioPoll>, b: NonNullable<StudioPoll>) =>
  a.status === b.status &&
  a.rev === b.rev &&
  a.res === b.res &&
  JSON.stringify([a.holder, a.stage]) === JSON.stringify([b.holder, b.stage]);

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
  // ---------------- caderno da live (editor Traço numa página própria, dentro do estúdio)
  const trFrame = useRef<HTMLIFrameElement>(null);
  /** o caderno é carregado na primeira vez que a cena do caderno aparece (e fica aberto: trocar de cena é na hora) */
  const [trMounted, setTrMounted] = useState(false);
  useEffect(() => {
    if (scene === 'pdf') setTrMounted(true);
  }, [scene]);
  type TracoApi = {
    open: (id: string) => Promise<void>;
    goPage: (nb: string, pg: string) => Promise<void>;
    notebook: () => string | null;
    remote: (m: unknown) => void;
    layers: (aspect?: number) => {
      bg: HTMLCanvasElement;
      hl: HTMLCanvasElement;
      ink: HTMLCanvasElement;
      live: HTMLCanvasElement;
      camSlot: HTMLElement;
      rev: { bg: number; ink: number; live: number };
      crop: { x: number; y: number; w: number; h: number };
      cropCss: { x: number; y: number; w: number; h: number; W: number; H: number };
    } | null;
    flush: () => Promise<unknown>;
    materials: (list: { id: string; title: string; path: string }[]) => void;
  };
  const trApi = useRef<TracoApi | null>(null);
  /** caderno aberto (os outros aparelhos abrem o mesmo) */
  const [trNb, setTrNb] = useState('');
  const trNbRef = useRef('');
  trNbRef.current = trNb;
  /** página aberta no caderno (também vai pela cena da live: os aparelhos se acertam mesmo se uma mensagem se perder) */
  const [trPg, setTrPg] = useState('');
  const trPgRef = useRef('');
  trPgRef.current = trPg;
  /** quando a página/caderno foi trocado aqui (uma cena atrasada que chega logo depois não desfaz a troca) */
  const trLocalAt = useRef(0);
  // ponte: o caderno (dentro do estúdio) chama estas funções
  const bridgeFns = useRef({
    exit: () => {},
    full: () => {},
  });
  bridgeFns.current.exit = () => void exitFull();
  bridgeFns.current.full = () => void (full ? exitFull() : enterFull());
  useEffect(() => {
    const w = window as Window & { __tracoBridge?: unknown };
    w.__tracoBridge = {
      // traço em andamento, alterações, página, enquadramento: na hora, para os outros aparelhos
      send: (m: unknown) => link.current?.sendNow({ t: 'tr', m }),
      exit: () => bridgeFns.current.exit(),
      full: () => bridgeFns.current.full(),
      notebook: () => trNbRef.current || null,
      opened: (id: string) => {
        if (trNbRef.current !== id) {
          trLocalAt.current = performance.now();
          setTrNb(id);
        }
        window.setTimeout(() => placeCam.current(), 50);
      },
      page: (nb: string, pg: string) => {
        trLocalAt.current = performance.now();
        if (trNbRef.current !== nb) setTrNb(nb);
        if (trPgRef.current !== pg) setTrPg(pg);
      },
      view: () => placeCam.current(),
      attach: (api: TracoApi) => {
        trApi.current = api;
      },
    };
    return () => {
      delete w.__tracoBridge;
    };
  }, []);
  /** a câmera da live dentro da folha, entre o papel e a tinta (a escrita fica por cima dela) */
  const placeCam = useRef<() => void>(() => {});
  const camStream = useRef<{ track: MediaStreamTrack; stream: MediaStream } | null>(null);
  /** arrastar a câmera pela alça (dentro do caderno) */
  const camDrag = useRef<(e: PointerEvent, handle: HTMLElement) => void>(() => {});
  camDrag.current = (e, handle) => {
    const l = trApi.current?.layers(canvasRef.current ? canvasRef.current.width / canvasRef.current.height : 16 / 9);
    if (!l) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
    const c = l.cropCss;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const b0 = { ...pipBox, x: pipRect.x, y: pipRect.y };
    const w = pipRect.w;
    const h = pipRect.h;
    pipAt.current = performance.now();
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      pipAt.current = performance.now();
      pipSet({ ...b0, x: b0.x + (ev.clientX - x0) / c.w, y: b0.y + (ev.clientY - y0) / c.h });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      cancelAnimationFrame(pipRaf.current);
      pipRaf.current = 0;
      const last = pipNext.current ?? b0;
      pipNext.current = null;
      const fixed = { x: Math.min(Math.max(0, last.x), 1 - w), y: Math.min(Math.max(0, last.y), 1 - h), w: last.w };
      setPipBox(fixed);
      savePip(fixed);
      pipAt.current = performance.now();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  placeCam.current = () => {
    const l = trApi.current?.layers(canvasRef.current ? canvasRef.current.width / canvasRef.current.height : 16 / 9);
    const slot = l?.camSlot;
    if (!l || !slot) return;
    const doc = slot.ownerDocument;
    const c = l.cropCss;
    // moldura discreta: o trecho da folha que vai para a live (só na tela do professor)
    let frame = slot.querySelector<HTMLDivElement>('div[data-frame]');
    if (scene === 'pdf') {
      if (!frame) {
        frame = doc.createElement('div');
        frame.dataset.frame = '1';
        frame.style.cssText = 'position:absolute;pointer-events:none;border:1.5px dashed rgba(35,71,217,.28);border-radius:4px';
        slot.prepend(frame);
      }
      Object.assign(frame.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` });
    } else frame?.remove();
    let box = slot.querySelector<HTMLDivElement>('div[data-cam]');
    const track = camTrack.current;
    const src: MediaStream | null = track && track.readyState === 'live' ? (camStream.current?.track === track ? camStream.current.stream : new MediaStream([track])) : null;
    if (track && src && camStream.current?.track !== track) camStream.current = { track, stream: src };
    // quem só escreve (não transmite): só o contorno de onde a câmera está — sem receber vídeo, como no TraçoApp
    const outline = !src && light;
    if (scene !== 'pdf' || !pip || (!src && !outline)) {
      box?.remove();
      return;
    }
    if (!box) {
      box = doc.createElement('div');
      box.dataset.cam = '1';
      box.style.cssText = 'position:absolute;border-radius:6%;pointer-events:none';
      const clip = doc.createElement('div');
      clip.style.cssText = 'position:absolute;inset:0;overflow:hidden;border-radius:inherit';
      const v = doc.createElement('video');
      v.muted = true;
      v.autoplay = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none';
      clip.appendChild(v);
      box.appendChild(clip);
      // alça para mover a câmera (o resto da câmera deixa a caneta escrever por cima)
      const handle = doc.createElement('div');
      handle.setAttribute('role', 'button');
      handle.setAttribute('aria-label', 'Mover a câmera');
      handle.title = 'Arraste para mover a câmera';
      handle.style.cssText =
        'position:absolute;top:-30px;left:50%;transform:translateX(-50%);width:44px;height:22px;border-radius:999px;border:2px solid #fff;background:rgba(0,0,0,.6);pointer-events:auto;touch-action:none;cursor:move;display:grid;place-items:center;box-shadow:0 1px 4px rgba(0,0,0,.3)';
      handle.innerHTML = '<span style="display:block;width:20px;height:2px;border-radius:2px;background:#fff"></span>';
      handle.addEventListener('pointerdown', (e) => camDrag.current(e, handle));
      box.appendChild(handle);
      slot.appendChild(box);
    }
    const r = pipRect;
    // a câmera fica no mesmo lugar em que aparece na live (dentro do trecho que vai para a live)
    Object.assign(box.style, { left: `${c.x + r.x * c.w}px`, top: `${c.y + r.y * c.h}px`, width: `${r.w * c.w}px`, height: `${r.h * c.h}px` });
    const v = box.querySelector('video')!;
    if (outline) {
      Object.assign(box.style, { background: 'rgba(20,33,61,.06)', boxShadow: 'inset 0 0 0 2px rgba(20,33,61,.25)' });
      if (v.srcObject) v.srcObject = null;
      v.style.display = 'none';
      return;
    }
    Object.assign(box.style, { background: '#000', boxShadow: '0 0 0 2px rgba(255,255,255,.85)' });
    v.style.display = '';
    v.style.transform = mirror ? 'scaleX(-1)' : '';
    if (v.srcObject !== src) {
      v.srcObject = src;
      void v.play().catch(() => {});
    }
  };
  // a folha muda de tamanho (girar o iPad, tela cheia): a câmera e a moldura acompanham
  useEffect(() => {
    const f = trFrame.current;
    if (!f) return;
    const ro = new ResizeObserver(() => window.setTimeout(() => placeCam.current(), 60));
    ro.observe(f);
    return () => ro.disconnect();
  }, [trMounted]);
  useEffect(() => {
    placeCam.current();
  });
  // a live desenha as camadas da folha do caderno (sem as linhas do papel)
  const tracoLayers = () => {
    if (sceneRef.current !== 'pdf') return null;
    const c = canvasRef.current;
    const l = trApi.current?.layers(c ? c.width / c.height : 16 / 9);
    return l ? { bg: l.bg, hl: l.hl, ink: l.ink, live: l.live, rev: l.rev, crop: l.crop } : null;
  };
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const stage = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  /**
   * Fora da tela cheia o estúdio é pequeno: o caderno é desenhado em tamanho grande (1280 de largura) e só reduzido
   * na tela — assim a folha que vai para a live sai nítida e as barras do caderno não tomam o espaço da página.
   */
  const trWrap = useRef<HTMLDivElement>(null);
  const [trSize, setTrSize] = useState<{ w: number; h: number; k: number } | null>(null);
  useEffect(() => {
    const el = trWrap.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const k = full || w >= 1000 ? 1 : w / 1280;
      setTrSize((o) => (o && o.w === w && o.h === h && o.k === k ? o : { w, h, k }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, trMounted]);
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
  /**
   * Câmera de outro aparelho em uso (ex.: celular): ele só manda a imagem; quem transmite e escreve continua
   * sendo este aparelho, então trocar de câmera não interrompe a live.
   */
  const [feed, setFeed] = useState<{ device: string; id: string } | null>(null);
  const feedRef = useRef(feed);
  feedRef.current = feed;
  const feedStreams = useRef(new Map<string, MediaStream>());
  /** a câmera em uso vem de outro aparelho (não é para parar a faixa ao trocar) */
  const camRemote = useRef(false);
  const feedTimer = useRef(0);
  /** câmera deste aparelho indo para quem transmite */
  const feedOut = useRef<MediaStream | null>(null);
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
  const snapAt = useRef(0);
  const snapshot = () => {
    const c = canvasRef.current;
    if (!c || performance.now() - snapAt.current < 3000) return;
    snapAt.current = performance.now();
    const t = document.createElement('canvas');
    t.width = 480;
    t.height = Math.round((480 * c.height) / c.width);
    t.getContext('2d')?.drawImage(c, 0, 0, t.width, t.height);
    // (toDataURL codificava na hora e segurava a tela; toBlob codifica em segundo plano)
    t.toBlob(
      (b) => {
        if (!b) return;
        const fr = new FileReader();
        fr.onload = () => {
          if (typeof fr.result === 'string') pendingPreview.current = fr.result;
        };
        fr.readAsDataURL(b);
      },
      'image/jpeg',
      0.55,
    );
  };
  useEffect(() => {
    // Quem só escreve no caderno trabalha como no TraçoApp: só escreve e manda os traços. A prévia da live
    // (atrás do caderno, ninguém vê) para, e a imagem da live deixa de vir para cá — quem transmite desenha a
    // folha e gera o vídeo; aqui sobra tudo para a caneta.
    if (!onAir) {
      if (light && scene === 'pdf') comp.current?.pause();
      else comp.current?.setFps(light ? 4 : 30);
    }
  }, [light, onAir, scene]);
  // pede (e repete a cada 5 s, para valer depois de reconexões) a imagem da live só quando ela aparece aqui
  useEffect(() => {
    const want = !(light && !onAir && scene === 'pdf');
    const tell = () => link.current?.sendNow({ t: 'mirror', on: want });
    tell();
    const t = window.setInterval(tell, 5000);
    return () => window.clearInterval(t);
  }, [light, onAir, scene]);
  /** aparelhos abertos no estúdio (nome, câmeras, microfones) */
  const [devices, setDevices] = useState<StudioDevice[]>([]);
  const reported = useRef({ key: '', at: 0 });
  const [scanning, setScanning] = useState(false);

  /** menu lateral da tela cheia: recolhido ou aberto */
  const [menuOpen, setMenuOpen] = useState(true);
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
    l.onFeed = (d, st) => onFeed.current(d, st);
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
    if (comp.current) comp.current.traco = tracoLayers;
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
      camTrack.current?.stop();
      screenTrack.current?.stop();
      micStream.current?.getTracks().forEach((t) => t.stop());
      void audio.current?.ctx.close();
    };
  }, []);

  const knownMics = useRef<Set<string> | null>(null);
  /** Lê a lista de câmeras e microfones. Microfone novo conectado já fica escolhido. */
  /**
   * `ask`: o navegador só mostra as câmeras (nome e identificação) depois que o aparelho autoriza a câmera
   * uma vez. Quem só controla nunca abriu a câmera, então pede a autorização, fecha em seguida e relê a lista.
   */
  async function refreshDevices(first: boolean, ask = false) {
    let list = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    if (ask && !list.some((d) => d.kind === 'videoinput' && d.deviceId && d.label)) {
      const st = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
      st?.getTracks().forEach((t) => t.stop());
      if (st) list = await navigator.mediaDevices.enumerateDevices().catch(() => list);
    }
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
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* o navegador recusou a captura: o arrasto segue mesmo assim */
    }
    // toque antigo que ficou sem o "soltar": esquece (senão o arrasto vira pinça e a câmera não anda)
    if (!pipDrag.current || performance.now() - pipAt.current > 1500) pipTouches.current.clear();
    pipAt.current = performance.now();
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
  /** último toque no quadradinho (posições que chegam de outros aparelhos não desfazem o arrasto) */
  const pipAt = useRef(0);
  /** arrasto: uma atualização por quadro da tela (cada movimento refazendo a tela travava o arrasto) */
  const pipNext = useRef<{ x: number; y: number; w: number } | null>(null);
  const pipRaf = useRef(0);
  const pipSet = (b: { x: number; y: number; w: number }) => {
    pipNext.current = b;
    if (!pipRaf.current)
      pipRaf.current = requestAnimationFrame(() => {
        pipRaf.current = 0;
        const n = pipNext.current;
        pipNext.current = null;
        if (n) setPipBox(n);
      });
  };
  const pipMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = pipDrag.current;
    const stageEl = pipArea.current;
    if (!d || !stageEl) return;
    pipAt.current = performance.now();
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
    if (d.mode === 'move') pipSet({ ...d.box, x: d.box.x + dx, y: d.box.y + dy });
    else pipSet({ ...d.box, w: Math.min(0.6, Math.max(0.12, d.box.w + dx)) });
  };
  const pipUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pipTouches.current.delete(e.pointerId);
    pipAt.current = performance.now();
    // última posição do arrasto ainda na fila
    cancelAnimationFrame(pipRaf.current);
    pipRaf.current = 0;
    const last = pipNext.current;
    pipNext.current = null;
    if (last) setPipBox(last);
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
      // no caderno a tela cheia é só do estúdio (não do navegador): sai apenas pelo botão
      if (!document.fullscreenElement && sceneRef.current !== 'pdf') setFull(false);
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
    // no caderno: sem a tela cheia do navegador (no iPad ela fecha ao arrastar para baixo, no meio da aula);
    // o estúdio ocupa a tela inteira e só sai pelo botão
    if (sceneRef.current === 'pdf') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      return;
    }
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
  // Na tela da transmissão (cena da câmera): arrastar escolhe a parte da imagem que aparece no recorte.
  // Na cena do caderno, a folha é do caderno (ele fica por cima do quadro).
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // tocar na tela fecha o popup de microfone/câmera
    if (pop) {
      setPop(null);
      return;
    }
    if (scene !== 'camera') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    if (!prev || scene !== 'camera' || ps.size !== 1) return;
    const rc = e.currentTarget.getBoundingClientRect();
    comp.current?.moveCamera((e.clientX - prev.x) / rc.width, (e.clientY - prev.y) / rc.height);
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
  };

  // Câmera escolhida
  useEffect(() => {
    if (!cam) return;
    if (feed && !light) {
      // câmera de outro aparelho: a daqui continua no ar até a imagem dele chegar (troca sem buraco)
      applyFeed();
      return;
    }
    window.clearTimeout(feedTimer.current);
    if (cam === 'none' || light) {
      comp.current?.setCamera(null);
      // (a faixa do outro aparelho não é nossa para parar)
      if (!camRemote.current) camTrack.current?.stop();
      camRemote.current = false;
      camTrack.current = null;
      return;
    }
    // já é esta câmera (ex.: a do outro aparelho não chegou e a daqui nunca saiu do ar)
    if (!camRemote.current && camTrack.current?.readyState === 'live' && camTrack.current.getSettings().deviceId === cam) {
      comp.current?.setCamera(camTrack.current);
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
        const wasRemote = camRemote.current;
        camRemote.current = false;
        camTrack.current = t;
        // a câmera anterior (daqui ou de outro aparelho) ficou no ar até agora: troca sem buraco
        comp.current?.setCamera(t);
        if (old && old !== t && !wasRemote) old.stop();
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
  }, [cam, res, light, feed]);

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
      // o caderno da live (PDFs da aula e páginas em branco ficam dentro dele)
      setScene('pdf');
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
  /** esta sessão viu a live no ar / já está saindo do estúdio */
  const sawLive = useRef(false);
  const leaving = useRef(false);
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
      if (isStage && r.previewWanted) snapshot();
      setRemote((o) => (o && sameRemote(o, r) ? o : r));
      // (a lista só muda quando um aparelho entra/sai ou troca de câmera: a tela não é refeita à toa)
      setDevices((o) => (JSON.stringify(o) === JSON.stringify(r.devices) ? o : r.devices));
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
      // a live que estava no ar foi encerrada (aqui ou em outro aparelho): os aparelhos saem do estúdio
      if (r.status === 'live') sawLive.current = true;
      else if (r.status === 'ended' && sawLive.current && !leaving.current) {
        leaving.current = true;
        window.setTimeout(() => router.push('/admin/ao-vivo'), caster.current ? 1500 : 300);
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
    sync.current.rev = r.rev;
    await applyScene(st);
  };

  type SceneState = {
    scene?: Scene;
    pip?: boolean;
    muted?: boolean;
    mirror?: boolean;
    pipBox?: { x: number; y: number; w: number };
    pipAspect?: number;
    trNb?: string;
    trPg?: string;
  };
  const sceneKey = (x: SceneState) => JSON.stringify([x.scene, x.pip, x.muted, x.mirror, x.pipBox, x.pipAspect, x.trNb, x.trPg]);
  const sceneNow = (): SceneState => ({ scene, pip, muted, mirror, pipBox, ...(trNb ? { trNb } : {}), ...(trPg ? { trPg } : {}), ...(camTrack.current && pipAspect ? { pipAspect } : {}) });
  /** Aplica a cena de outro aparelho (sem mandar de volta). */
  async function applyScene(st: SceneState) {
    sync.current.applying = true;
    try {
      // caderno aberto em outro aparelho: abre o mesmo aqui
      const fresh = performance.now() - trLocalAt.current > 3000;
      if (fresh && st.trNb && st.trNb !== trNbRef.current) {
        setTrNb(st.trNb);
        if (!st.trPg) void trApi.current?.open(st.trNb);
      }
      if (fresh && st.trPg && st.trPg !== trPgRef.current) {
        setTrPg(st.trPg);
        void trApi.current?.goPage(st.trNb || trNbRef.current, st.trPg);
      }
      if (st.scene && st.scene !== scene) setScene(st.scene);
      if (typeof st.pip === 'boolean' && st.pip !== pip) setPip(st.pip);
      if (typeof st.muted === 'boolean' && st.muted !== muted) setMuted(st.muted);
      if (typeof st.mirror === 'boolean' && st.mirror !== mirror) setMirror(st.mirror);
      // arrastando a câmera aqui: a posição que chega de fora (atrasada) não puxa o quadradinho de volta
      if (st.pipBox && !pipDrag.current && performance.now() - pipAt.current > 2500 && sceneKey({ pipBox: st.pipBox }) !== sceneKey({ pipBox })) setPipBox(st.pipBox);
      if (st.pipAspect && comp.current && !camTrack.current) {
        comp.current.camAspect = st.pipAspect;
        setPipRect(comp.current.pipRect());
      }
      sync.current.sent = sceneKey({ ...sceneNow(), ...st });
    } finally {
      window.setTimeout(() => (sync.current.applying = false), 300);
    }
  }

  // Mensagens da ligação direta
  const devicesNow = () => ({
    cams: [...cams.map((c, i) => ({ id: c.deviceId, name: camName(c, i, cams) })), { id: 'none', name: 'Sem câmera' }],
    mics: [...(android ? [{ id: AUTO_MIC, name: AUTO_MIC_NAME }] : []), ...mics.map((m, i) => ({ id: m.deviceId, name: micName(m, i) })), { id: 'none', name: 'Sem microfone' }],
    cam,
    mic,
  });
  onLinkMsg.current = (m, from) => {
    if (m.t === 'tr') {
      trApi.current?.remote(m.m);
      // quem transmite repassa para os outros aparelhos (cada um fala só com quem transmite)
      if (caster.current || stageDev === device.current.id) link.current?.sendNow(m, { except: from });
      return;
    }
    if (m.t === 'mirror') {
      link.current?.setMirrorFor(from, Boolean(m.on));
      return;
    }
    if (m.t === 'scene') void applyScene(m.s as SceneState);
    else if (m.t === 'devices') setHostDev(m.d as typeof hostDev);
    else if (m.t === 'cam' && caster.current) setCam(String(m.id));
    else if (m.t === 'mic' && caster.current) setMic(String(m.id));
  };
  // quem transmite manda o estado completo para o aparelho que acabou de ligar
  onLinkOpen.current = (d) => {
    if (!caster.current || !link.current) return;
    link.current.post({ t: 'scene', s: sceneNow() }, d);
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
        pip,
        muted,
        mirror,
        pipBox,
        ...(trNb ? { trNb } : {}),
        ...(trPg ? { trPg } : {}),
        ...(camTrack.current && pipAspect ? { pipAspect } : {}),
      }).catch(() => null);
      if (r) sync.current.rev = Math.max(sync.current.rev, r.rev);
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, pip, muted, mirror, pipBox, pipAspect, trNb, trPg, liveId]);

  // Câmeras e microfones deste aparelho para os outros verem (só quando muda, ou a cada 15 s)
  const reportRef = useRef<() => Omit<StudioDevice, 'device'> | null>(() => null);
  reportRef.current = () => {
    const d = devicesNow();
    // "@aparelho|câmera": a câmera em uso vem de outro aparelho
    const rep = { label: device.current.label, cams: d.cams.filter((c) => c.id !== 'none'), mics: d.mics.filter((m) => m.id !== 'none'), cam: feed ? `@${feed.device}|${feed.id}` : cam, mic };
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

  /** usa a imagem que chega do outro aparelho como a câmera da live */
  function applyFeed() {
    const f = feedRef.current;
    if (!f || light) return;
    const track = feedStreams.current.get(f.device)?.getVideoTracks()[0];
    window.clearTimeout(feedTimer.current);
    const back = (why: string) => {
      if (feedRef.current?.device !== f.device) return;
      toast.error(why);
      void studioCommand(liveId, f.device, { t: 'feed', id: '' }).catch(() => null);
      setFeed(null);
    };
    if (track && track.readyState === 'live' && !track.muted) {
      if (camTrack.current !== track) {
        const old = camTrack.current;
        const oldRemote = camRemote.current;
        camTrack.current = track;
        camRemote.current = true;
        comp.current?.setCamera(track);
        // só agora a câmera daqui é solta
        if (old && !oldRemote) old.stop();
        // travou (tela do outro aparelho apagou, app em segundo plano) ou acabou: a câmera daqui assume
        track.onmute = () => {
          window.clearTimeout(feedTimer.current);
          feedTimer.current = window.setTimeout(() => back('A câmera do outro aparelho parou. Voltei para a câmera daqui.'), 4000);
        };
        track.onunmute = () => window.clearTimeout(feedTimer.current);
        track.onended = () => back('A câmera do outro aparelho parou. Voltei para a câmera daqui.');
      }
      return;
    }
    if (track) track.onunmute = () => applyFeed();
    // ainda não chegou (ou caiu): a câmera daqui continua; se demorar, desiste sem derrubar a live
    feedTimer.current = window.setTimeout(() => back('A câmera do outro aparelho não chegou (abra o Estúdio nele). Fiquei com a câmera daqui.'), 25_000);
  }
  const onFeed = useRef<(d: string, st: MediaStream | null) => void>(() => {});
  onFeed.current = (d, st) => {
    if (st) feedStreams.current.set(d, st);
    else feedStreams.current.delete(d);
    if (feedRef.current?.device !== d) return;
    if (!st && camRemote.current) {
      // a ligação caiu: volta para a câmera daqui na hora (o último quadro fica até ela abrir)
      window.clearTimeout(feedTimer.current);
      setFeed(null);
      return;
    }
    applyFeed();
  };
  /** Este aparelho manda a câmera para quem transmite ('' = para de mandar). */
  async function sendCamera(id: string) {
    feedOut.current?.getTracks().forEach((t) => t.stop());
    feedOut.current = null;
    if (!id) return link.current?.setUpstream(null);
    const want = (deviceId?: string) =>
      navigator.mediaDevices.getUserMedia({
        video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30 } },
      });
    const st = await want(id).catch(() => want().catch(() => null));
    if (!st) return toast.error('Não foi possível abrir a câmera deste aparelho.');
    feedOut.current = st;
    link.current?.setUpstream(st);
    toast('Enviando a câmera deste aparelho para a live');
  }
  // este aparelho passou a transmitir (ou saiu do estúdio): para de mandar a câmera como "outro aparelho"
  useEffect(() => {
    if (!light && feedOut.current) void sendCamera('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light]);
  useEffect(() => () => feedOut.current?.getTracks().forEach((t) => t.stop()), []);

  // Comandos de outros aparelhos
  const onCmd = useRef<(c: { t: string; id?: string }) => Promise<void>>(async () => {});
  onCmd.current = async (c) => {
    if (c.t === 'scan') {
      await refreshDevices(false, true);
      reported.current.key = '';
    } else if (c.t === 'cam' && caster.current && c.id) setCam(c.id);
    else if (c.t === 'feed') await sendCamera(light ? (c.id ?? '') : '');
    else if (c.t === 'usecam' && !light && c.id) await pickAnyCam(c.id);
    else if (c.t === 'mic' && caster.current && c.id) setMic(c.id);
    else if (c.t === 'take') {
      if (liveOn) toast('Assumindo a live…');
      await takeOver(c.id);
    } else if (c.t === 'start' && !caster.current && !liveOn) await goLive();
  };

  // tela inteira sem a tela cheia do navegador: os menus do app saem da frente
  useEffect(() => {
    document.documentElement.classList.toggle('studio-full', full);
    return () => document.documentElement.classList.remove('studio-full');
  }, [full]);
  // tela cheia: a página por trás não rola nem recarrega ao arrastar (só os painéis do estúdio rolam)
  useEffect(() => {
    if (!full) return;
    const root = document.documentElement.style;
    const prev = [root.overflow, root.overscrollBehavior, document.body.style.overflow];
    root.overflow = 'hidden';
    root.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    const stop = (e: TouchEvent) => {
      if (e.cancelable && !(e.target as Element | null)?.closest?.('[data-scroll], input, select, textarea, [role=dialog]')) e.preventDefault();
    };
    document.addEventListener('touchmove', stop, { capture: true, passive: false });
    return () => {
      [root.overflow, root.overscrollBehavior, document.body.style.overflow] = prev;
      document.removeEventListener('touchmove', stop, { capture: true });
    };
  }, [full]);
  /** Escolheu uma câmera na lista de todos os aparelhos: troca nele ou passa a live para ele. */
  async function pickAnyCam(v: string) {
    const [dev, id] = v.split('|');
    const me = device.current.id;
    if (light) {
      // quem só controla pede ao aparelho que transmite; a live não muda de aparelho
      if (stageDev) await studioCommand(liveId, stageDev, { t: 'usecam', id: v });
      return;
    }
    const stop = feedRef.current;
    if (dev === me) {
      // câmera daqui: a do outro aparelho só é desligada depois que a daqui abriu (troca sem buraco)
      if (stop) window.setTimeout(() => void studioCommand(liveId, stop.device, { t: 'feed', id: '' }), 2500);
      setFeed(null);
      setCam(id);
      return;
    }
    // câmera de outro aparelho: ele manda a imagem e este continua transmitindo
    if (stop && stop.device !== dev) void studioCommand(liveId, stop.device, { t: 'feed', id: '' });
    setFeed({ device: dev, id });
    await studioCommand(liveId, dev, { t: 'feed', id });
    toast(`Câmera do ${devices.find((d) => d.device === dev)?.label ?? 'outro aparelho'}…`);
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
      .filter((d) => d.device !== device.current.id)
      .map((d) => ({ device: d.device, label: `${d.label}${tag(d.device)}`, cams: d.cams })),
  ];
  const camValue = holderDev
    ? holderDev.cam.startsWith('@')
      ? holderDev.cam.slice(1)
      : `${holderDev.device}|${holderDev.cam}`
    : feed
      ? `${feed.device}|${feed.id}`
      : `${device.current.id}|${cam}`;
  async function scanAll() {
    setScanning(true);
    await refreshDevices(false, true);
    reported.current.key = '';
    await studioScan(liveId).catch(() => null);
    window.setTimeout(() => setScanning(false), 2500);
  }

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
        // quadros adaptativos: de 22 a 30 por segundo (ritmo estável: buscar mais que 30 fazia o aparelho
        // oscilar entre subir e perder quadros, e a live engasgava)
        minFps: 22,
        maxFps: 30,
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
      void setStudioScene(liveId, { res, scene, pip, muted, ...(trNb ? { trNb } : {}) });
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
      if (r.error) {
        toast.error(r.error);
        router.refresh();
      } else {
        // encerrou: sai do estúdio e volta para a lista das transmissões
        toast('Transmissão encerrada');
        leaving.current = true;
        router.push('/admin/ao-vivo');
      }
    } finally {
      setBusy(false);
    }
  }

  const blocked = !support?.ok || !ready;

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
                full && scene !== 'pdf'
                  ? {
                      width: 'min(100%, calc(100dvh * 16 / 9))',
                      aspectRatio: '16 / 9',
                    }
                  : full
                    ? { width: '100%', height: '100%' }
                    : { position: 'absolute', inset: 0 }
              }
            >
              {/* caderno da live: o editor do Traço, como ele é (a live desenha as camadas da folha dele) */}
              {trMounted && (
                <div ref={trWrap} className={cn('absolute inset-0 z-[5] overflow-hidden', scene !== 'pdf' && 'invisible')}>
                  <iframe
                    ref={trFrame}
                    title="Caderno da live"
                    src={`/traco/estudio.html?live=${encodeURIComponent(liveId)}`}
                    className="absolute top-0 left-0 border-0 bg-[#edf0f4]"
                    style={
                      trSize && trSize.k !== 1
                        ? { width: 1280, height: trSize.h / trSize.k, transform: `scale(${trSize.k})`, transformOrigin: '0 0' }
                        : { width: '100%', height: '100%' }
                    }
                  />
                </div>
              )}
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
                  scene === 'camera' && fit === 'cover' && 'cursor-grab touch-none active:cursor-grabbing',
                  // no caderno, a prévia fica atrás dele: fora da tela (o navegador não gasta para mostrá-la; a live segue igual)
                  scene === 'pdf' && trMounted && 'invisible',
                )}
                aria-label="Prévia da transmissão"
              />
              {/* reserva: foto da imagem da live (1 por segundo) quando a ligação direta não conecta */}
              {light && !mirrorOk && previewSrc && !touching && scene !== 'pdf' && (
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
                className={cn('pointer-events-none absolute inset-0 size-full bg-black object-contain', (!viewing || touching || scene === 'pdf') && 'hidden', viewing && !mirrorOk && previewSrc && 'opacity-0')}
              />
              {/* Quadradinho da câmera: arraste para qualquer lugar; toque para mudar o tamanho (não aparece na live) */}
              {scene === 'both' && (camTrack.current || light) && (
                <div ref={pipArea} className="pointer-events-none absolute inset-0 z-[6]">
                  <div
                    role="button"
                    aria-label="Quadradinho da câmera"
                    onPointerDown={(e) => pipDown(e, 'move')}
                    onPointerMove={pipMove}
                    onPointerUp={pipUp}
                    onPointerCancel={pipUp}
                    className={cn(
                      'absolute cursor-move touch-none rounded-[6%]',
                      'pointer-events-auto',
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
                    {/* aparelho que só controla: enquanto escreve/mexe, a câmera continua ao vivo aqui (recorte da imagem da live) */}
                    {light && mirrorStream && (
                      <div className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]', !(touching || !viewing) && 'invisible')}>
                        <video
                          ref={(v) => {
                            if (v && v.srcObject !== mirrorStream) {
                              v.srcObject = mirrorStream;
                              void v.play().catch(() => {});
                            }
                          }}
                          autoPlay
                          muted
                          playsInline
                          className="absolute max-w-none object-fill"
                          style={{
                            width: `${100 / pipRect.w}%`,
                            height: `${100 / pipRect.h}%`,
                            left: `${(-pipRect.x / pipRect.w) * 100}%`,
                            top: `${(-pipRect.y / pipRect.h) * 100}%`,
                          }}
                        />
                      </div>
                    )}
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
              <span className={'absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white'}>
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
            <div
              data-scroll
              className={cn(
                'absolute z-30 flex items-center gap-1.5',
                full
                  ? 'no-scrollbar top-1/2 right-2 max-h-[calc(100%-1rem)] -translate-y-1/2 flex-col overflow-y-auto rounded-[26px] border border-white/10 bg-neutral-900/70 p-1 backdrop-blur-xl'
                  : scene === 'pdf'
                    ? 'bottom-2 left-2' // no caderno: embaixo, à esquerda (em cima ficam os botões do caderno)
                    : status?.state === 'reconnecting'
                      ? 'top-10 right-2'
                      : 'top-2 right-2',
                full && !menuOpen && '[&>*:not(:first-child)]:hidden',
              )}
            >
              {full && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((v) => !v);
                    setPop(null);
                  }}
                  aria-label={menuOpen ? 'Recolher menu' : 'Mostrar menu'}
                  aria-expanded={menuOpen}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-white hover:bg-white/15"
                >
                  {menuOpen ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
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
                data-scroll
                className={cn(
                  'absolute z-40 w-64 space-y-2 overflow-y-auto rounded-2xl border border-line-strong bg-surface/95 p-3 shadow-2xl backdrop-blur',
                  full ? 'top-1/2 right-16 max-h-[calc(100%-1rem)] max-w-[calc(100%-5rem)] -translate-y-1/2' : 'top-12 right-2 max-h-[calc(100%-3.5rem)] max-w-[calc(100%-1rem)]',
                )}
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
                    {/* câmeras de todos os aparelhos abertos no estúdio (a de outro aparelho só manda a imagem) */}
                    <button
                      type="button"
                      onClick={scanAll}
                      disabled={scanning}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand"
                    >
                      <RefreshCw className={cn('size-3.5', scanning && 'animate-spin')} /> Procurar câmeras (outros aparelhos)
                    </button>
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {camGroups.map((g) => (
                        <div key={g.device}>
                          {camGroups.length > 1 && <p className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider text-muted uppercase">{g.label}</p>}
                          <ul className="space-y-1">
                            {!g.cams.length && <li className="px-2.5 py-1.5 text-[11px] text-muted">Sem câmera liberada — abra a câmera nele e toque em Procurar</li>}
                            {g.cams.map((o) => {
                              const v = `${g.device}|${o.id}`;
                              return (
                                <li key={v}>
                                  <button
                                    type="button"
                                    onClick={() => void pickAnyCam(v)}
                                    className={cn('w-full truncate rounded-lg px-2.5 py-2 text-left text-xs', camValue === v ? 'bg-brand text-white' : 'text-ink hover:bg-surface-2')}
                                  >
                                    {o.name}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                      {!light && (
                        <button
                          type="button"
                          onClick={() => void pickAnyCam(`${device.current.id}|none`)}
                          className={cn('w-full truncate rounded-lg px-2.5 py-2 text-left text-xs', !feed && cam === 'none' ? 'bg-brand text-white' : 'text-ink hover:bg-surface-2')}
                        >
                          Sem câmera
                        </button>
                      )}
                    </div>
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
              <div
                className={cn(
                  'absolute inset-x-0 bottom-0 z-[7] flex flex-wrap items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
                  scene === 'pdf' ? 'pointer-events-none justify-end [&>*]:pointer-events-auto' : 'justify-center bg-gradient-to-t from-black/70 to-transparent pt-6',
                )}
              >
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
          {full && confirmEnd && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
              <div className="w-full max-w-sm space-y-4 rounded-3xl border border-line-strong bg-surface p-5 shadow-2xl">
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
              </div>
            </div>
          )}
          {/* Chat ao lado, só para o professor, na tela cheia horizontal */}
          {full && chat && chatOpen && (
            <aside
              aria-label="Chat da live"
              data-scroll
              className="absolute top-2 right-16 bottom-2 z-40 w-[min(340px,calc(100%-5rem))] animate-scale-in overflow-hidden rounded-2xl border border-white/15 bg-surface shadow-2xl"
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
        {/* Caderno da live (editor Traço) */}
        {scene === 'pdf' && (
          <div className="space-y-2 rounded-2xl border border-line bg-surface p-3">
            <p className="text-xs text-muted">
              Escreva no caderno acima. PDFs da aula, páginas novas e outros cadernos entram pelo <b>+</b> do caderno; o que aparece nele vai para a live.
            </p>
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={pip} onChange={(e) => setPip(e.target.checked)} className="size-4 accent-[#3b82f6]" /> Minha câmera no canto
            </label>
            <MirrorButton mirror={mirror} onToggle={() => setMirror((m) => !m)} />
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
                {!g.cams.length && (
                  <option disabled value={`${g.device}|-`}>
                    Sem câmera liberada (toque em Atualizar)
                  </option>
                )}
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
    </div>
  );
}
