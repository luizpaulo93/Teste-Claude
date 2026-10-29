'use client';

import {
  Captions,
  CheckCircle2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, formatClock } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return apiPromise;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const HIDE_AFTER_MS = 2000; // controles somem 2 s depois do último toque
const EDGE = 0.28; // 28% de cada lado: toque duplo volta/avança 10 s
const SAVE_EVERY_SEC = 30;

const WM_POS = [
  'top-[10%] left-[4%]',
  'top-[16%] right-[4%]',
  'top-[42%] left-[4%]',
  'top-[46%] right-[4%]',
  'top-[68%] left-[4%]',
  'top-[72%] right-[4%]',
];

export interface VideoPlayerProps {
  videoId: string;
  title?: string;
  poster?: string;
  watermark?: string;
  startAt?: number;
  /** Chamado a cada 30 s assistindo e sempre que pausa, termina ou sai da página. */
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
  onNext?: () => void;
  /** Aula concluída? Mostra o botão certo na tela de fim. */
  completed?: boolean;
  onToggleComplete?: () => void;
  /** Modo cinema (só no computador). */
  theater?: boolean;
  onToggleTheater?: () => void;
  /** Transmissão ao vivo: esconde a linha do tempo e mostra o selo AO VIVO. */
  live?: boolean;
}

export function VideoPlayer({
  videoId,
  title = '',
  poster,
  watermark,
  startAt = 0,
  onProgress,
  onEnded,
  onNext,
  completed,
  onToggleComplete,
  theater,
  onToggleTheater,
  live,
}: VideoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const tickRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const tapRef = useRef<{ side: 'left' | 'right' | null; at: number; timer: number | null; total: number }>({ side: null, at: 0, timer: null, total: 0 });
  const feedbackTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const endedRef = useRef(false);
  const ccRef = useRef(false);
  const mountedCc = useRef(false);
  const speedRef = useRef(1);
  const volRef = useRef({ volume: 100, muted: false });

  const cb = useRef({ onProgress, onEnded });
  cb.current = { onProgress, onEnded };

  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(startAt > 3 ? startAt : 0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [cc, setCc] = useState(false);
  const [fs, setFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [controls, setControls] = useState(false);
  const [seeking, setSeeking] = useState<number | null>(null);
  const [wmPos, setWmPos] = useState(0);
  const [ytError, setYtError] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ side: 'left' | 'right'; sec: number; key: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const report = useCallback((force = false) => {
    const p = playerRef.current;
    if (!p?.getCurrentTime) return;
    const t = Math.floor(p.getCurrentTime() || 0);
    const d = Math.floor(p.getDuration() || 0);
    if (t <= 0) return;
    if (!force && Math.abs(t - lastSaved.current) < SAVE_EVERY_SEC) return;
    lastSaved.current = t;
    cb.current.onProgress?.(t, d);
  }, []);

  // Troca de aula: zera tudo e destrói o player anterior
  useEffect(() => {
    setStarted(false);
    setReady(false);
    setPlaying(false);
    setEnded(false);
    endedRef.current = false;
    setTime(startAt > 3 ? startAt : 0);
    setDuration(0);
    setYtError(null);
    setControls(false);
    lastSaved.current = 0;
    return () => {
      report(true);
      if (tickRef.current) window.clearInterval(tickRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
  }, [videoId, startAt, report]);

  // Marca d'água muda de lugar a cada 20 s
  useEffect(() => {
    if (!watermark) return;
    setWmPos(Math.floor(Math.random() * WM_POS.length));
    const t = window.setInterval(() => setWmPos((p) => (p + 1 + Math.floor(Math.random() * (WM_POS.length - 1))) % WM_POS.length), 20000);
    return () => window.clearInterval(t);
  }, [watermark]);

  // Salva a posição ao trocar de aba / fechar a página
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && report(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [report]);

  /** Mostra os controles e esconde depois de 2 s sem nenhuma ação. */
  const scheduleHide = useCallback(() => {
    setControls(true);
    if (hideRef.current) window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => setControls(false), HIDE_AFTER_MS);
  }, []);

  const hideNow = useCallback(() => {
    if (hideRef.current) window.clearTimeout(hideRef.current);
    setControls(false);
  }, []);

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const d = playerRef.current?.getDuration?.() || 0;
    if (d) setTime(d);
    setEnded(true);
    setPlaying(false);
    setControls(true);
    report(true);
    cb.current.onEnded?.();
  }, [report]);

  const mount = useCallback(
    async (resumeAt: number, autoplay: boolean) => {
      setStarted(true);
      setReady(false);
      const YT = await loadYouTubeApi();
      if (!mountRef.current) return;
      if (tickRef.current) window.clearInterval(tickRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      const el = document.createElement('div');
      mountRef.current.innerHTML = '';
      mountRef.current.appendChild(el);
      mountedCc.current = ccRef.current;
      playerRef.current = new YT.Player(el, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          hl: 'pt',
          cc_lang_pref: 'pt',
          cc_load_policy: ccRef.current ? 1 : 0,
          start: !live && resumeAt > 3 ? Math.floor(resumeAt) : 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            setReady(true);
            setDuration(e.target.getDuration() || 0);
            if (volRef.current.muted) e.target.mute();
            else e.target.setVolume(volRef.current.volume);
            if (speedRef.current !== 1) e.target.setPlaybackRate(speedRef.current);
            if (ccRef.current) syncCaptions(e.target, true);
            if (autoplay) e.target.playVideo();
          },
          onApiChange: (e: any) => ccRef.current && syncCaptions(e.target, true),
          onError: (e: any) => {
            setYtError(Number(e.data) || 1);
            setReady(true);
          },
          onStateChange: (e: any) => {
            const st = e.data;
            setPlaying(st === 1);
            if (st === 1) {
              endedRef.current = false;
              setEnded(false);
              setDuration(e.target.getDuration() || 0);
            }
            if (st === 2) report(true);
            if (st === 0) finish();
          },
        },
      });

      tickRef.current = window.setInterval(() => {
        const p = playerRef.current;
        if (!p?.getCurrentTime) return;
        const t = p.getCurrentTime() || 0;
        const d = p.getDuration() || 0;
        setTime(t);
        if (d) setDuration(d);
        setBuffered((p.getVideoLoadedFraction?.() || 0) * 100);
        if (p.getPlayerState?.() === 1) {
          report();
          // Para um pouco antes do fim: o YouTube não chega a mostrar vídeos sugeridos
          if (!live && d > 3 && t >= d - 0.85) {
            p.pauseVideo();
            finish();
          }
        }
      }, 250);
    },
    [videoId, live, report, finish],
  );

  const start = useCallback(() => {
    if (!started) mount(startAt, true);
  }, [started, mount, startAt]);

  const play = useCallback(() => {
    const p = playerRef.current;
    if (!started) return start();
    if (!p?.playVideo) return;
    if (endedRef.current) {
      p.seekTo(0, true);
      endedRef.current = false;
      setEnded(false);
    }
    p.playVideo();
    scheduleHide();
  }, [started, start, scheduleHide]);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo?.();
    report(true);
  }, [report]);

  const toggle = useCallback(() => {
    if (playerRef.current?.getPlayerState?.() === 1) pause();
    else play();
  }, [play, pause]);

  const seekTo = useCallback((sec: number) => {
    const p = playerRef.current;
    if (!p?.seekTo) return;
    const d = p.getDuration() || 0;
    const s = Math.max(0, Math.min(d ? d - 1 : sec, sec));
    p.seekTo(s, true);
    setTime(s);
    if (endedRef.current) {
      endedRef.current = false;
      setEnded(false);
    }
  }, []);

  const skip = useCallback((delta: number) => seekTo((playerRef.current?.getCurrentTime?.() || 0) + delta), [seekTo]);

  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1500);
  };

  /** Toque duplo nas laterais: volta/avança 10 s (acumula: 10, 20, 30…). */
  const edgeSeek = (side: 'left' | 'right') => {
    if (live || !ready) return;
    skip(side === 'left' ? -10 : 10);
    const total = tapRef.current.side === side && feedback ? tapRef.current.total + 10 : 10;
    tapRef.current.total = total;
    setFeedback({ side, sec: total, key: Date.now() });
    hideNow(); // avançar/voltar não mostra os controles
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => {
      setFeedback(null);
      tapRef.current.total = 0;
    }, 700);
  };

  /**
   * Clique/toque no vídeo:
   * - um toque mostra os controles (somem sozinhos em 2 s) ou esconde se já estiverem na tela;
   * - toque duplo na esquerda volta 10 s, na direita avança 10 s (sem mostrar os controles);
   * - clique duplo no meio: tela cheia. Play/pause fica na barra de baixo.
   */
  const onSurface = (e: React.PointerEvent<HTMLDivElement>) => {
    if (ended) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    const side = x <= EDGE ? 'left' : x >= 1 - EDGE ? 'right' : null;
    const touch = e.pointerType !== 'mouse';
    const now = Date.now();
    const t = tapRef.current;
    const isDouble = now - t.at < 320 && t.side === side;
    t.at = now;
    t.side = side;
    if (t.timer) window.clearTimeout(t.timer);
    t.timer = null;

    if (isDouble) {
      if (side) edgeSeek(side);
      else toggleFs();
      return;
    }
    // Espera um instante para saber se é toque duplo
    const single = () => {
      if (!ready) return;
      if (controls) hideNow();
      else scheduleHide();
    };
    // Espera um instante para saber se vem um segundo toque
    t.timer = window.setTimeout(single, side || !touch ? 260 : 200);
  };

  const toggleMute = () => {
    const p = playerRef.current;
    const next = !muted;
    setMuted(next);
    volRef.current.muted = next;
    if (!p) return;
    if (next) p.mute();
    else {
      p.unMute();
      p.setVolume(volume || 80);
    }
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    volRef.current.volume = v;
    const p = playerRef.current;
    if (!p) return;
    p.setVolume(v);
    if (v > 0 && muted) {
      p.unMute();
      setMuted(false);
      volRef.current.muted = false;
    }
    if (v === 0) {
      p.mute();
      setMuted(true);
      volRef.current.muted = true;
    }
  };

  const changeSpeed = (s: number) => {
    playerRef.current?.setPlaybackRate?.(s);
    speedRef.current = s;
    setSpeed(s);
    setSpeedOpen(false);
    scheduleHide();
  };

  const toggleCaptions = () => {
    const next = !cc;
    setCc(next);
    ccRef.current = next;
    const p = playerRef.current;
    flash(next ? 'Legenda ativada' : 'Legenda desativada');
    if (!p) return;
    if (next && !mountedCc.current) {
      // O YouTube só liga a legenda de forma confiável recriando o player no mesmo ponto
      const at = Math.floor(p.getCurrentTime?.() || time);
      const wasPlaying = p.getPlayerState?.() === 1;
      mount(at, wasPlaying);
    } else syncCaptions(p, next);
    scheduleHide();
  };

  const toggleFs = useCallback(() => {
    const el = wrapRef.current as any;
    if (!el) return;
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
      (screen.orientation as any)?.unlock?.();
      return;
    }
    if (pseudoFs) return setPseudoFs(false);
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      Promise.resolve(req.call(el))
        .then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => {}))
        .catch(() => setPseudoFs(true));
    } else setPseudoFs(true); // iPhone: tela cheia "simulada"
  }, [pseudoFs]);

  useEffect(() => {
    const onFs = () => setFs(Boolean((document as any).fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
    };
  }, []);

  // Tela cheia simulada (iPhone): trava a rolagem e sai com Esc
  useEffect(() => {
    if (!pseudoFs) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPseudoFs(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [pseudoFs]);

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight' || e.key === 'l') !live && skip(10);
      else if (e.key === 'ArrowLeft' || e.key === 'j') !live && skip(-10);
      else if (e.key === 'f') toggleFs();
      else if (e.key === 'm') toggleMute();
      else if (e.key === 'c') toggleCaptions();
      else if (e.key === 't' && onToggleTheater) onToggleTheater();
      else return;
      if (started) scheduleHide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shownTime = seeking ?? time;
  const pct = duration ? Math.min(100, (shownTime / duration) * 100) : 0;
  const isFull = fs || pseudoFs;
  const barVisible = ready && !ytError && (controls || ended) && !speedOpen;

  return (
    <div
      ref={wrapRef}
      onPointerMove={started && !ended ? (e) => e.pointerType === 'mouse' && scheduleHide() : undefined}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'group/player relative isolate overflow-hidden bg-black select-none',
        pseudoFs ? 'fixed inset-0 z-[100] h-[100dvh] w-screen' : 'aspect-video w-full rounded-none sm:rounded-2xl',
        isFull && !barVisible && playing && 'cursor-none',
      )}
    >
      {/* Vídeo do YouTube (maior que a moldura para esconder título e logo do YouTube) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          ref={mountRef}
          className={cn(
            'w-full transition-all duration-200 [&>iframe]:pointer-events-none [&>iframe]:size-full',
            cc ? 'h-full' : '-mt-[60px] h-[calc(100%+120px)] sm:-mt-[80px] sm:h-[calc(100%+160px)]',
          )}
        />
      </div>

      {/* Camada que recebe os cliques (o aluno nunca clica no YouTube) */}
      {started && <div className="absolute inset-0 z-10" onPointerUp={onSurface} />}

      {/* Volta/avança 10 s */}
      {feedback && (
        <div
          key={feedback.key}
          className={cn(
            'pointer-events-none absolute inset-y-0 z-30 flex w-28 animate-fade-in items-center justify-center sm:w-40',
            feedback.side === 'left' ? 'left-0 rounded-r-full bg-gradient-to-r from-black/60 to-transparent' : 'right-0 rounded-l-full bg-gradient-to-l from-black/60 to-transparent',
          )}
        >
          <div className="flex flex-col items-center gap-1 text-white">
            <span className="grid size-11 place-items-center rounded-full border border-white/25 bg-white/15 backdrop-blur-sm">
              {feedback.side === 'left' ? <RotateCcw className="size-5" /> : <RotateCw className="size-5" />}
            </span>
            <span className="text-xs font-bold tabular-nums">{feedback.side === 'left' ? `-${feedback.sec}s` : `+${feedback.sec}s`}</span>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          {toast}
        </div>
      )}

      {watermark && started && (
        <div
          aria-hidden
          className={cn('pointer-events-none absolute z-[35] max-w-[85%] truncate text-[10px] font-semibold text-white/30 transition-all duration-1000 sm:text-xs', WM_POS[wmPos])}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }}
        >
          {watermark}
        </div>
      )}

      {/* Capa antes de começar */}
      {!started && (
        <button type="button" onClick={start} className="group absolute inset-0 z-30 cursor-pointer" aria-label="Reproduzir aula">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="hero-fallback absolute inset-0" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full border border-white/20 bg-brand/90 text-white shadow-[0_8px_32px_rgba(37,99,235,0.6)] transition-transform group-hover:scale-110 sm:size-20">
              <Play className="ml-1 size-7 fill-current sm:size-9" />
            </span>
          </span>
          {title && <span className="absolute inset-x-0 bottom-0 truncate p-4 text-left text-sm font-bold text-white/90 sm:p-6">{title}</span>}
          {live && (
            <span className="absolute top-4 left-4 flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
            </span>
          )}
          {startAt > 3 && !live && (
            <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              Continuar de {formatClock(startAt)}
            </span>
          )}
        </button>
      )}

      {ytError !== null && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/95 p-6 text-center text-white">
          <div className="max-w-sm">
            <p className="font-bold">{live ? 'Não foi possível abrir a transmissão' : 'Não foi possível carregar o vídeo'}</p>
            <p className="mt-2 text-sm text-white/65">
              {ytError === 101 || ytError === 150 || ytError === 153
                ? 'O vídeo não permite reprodução fora do YouTube. Peça ao professor para ativar “Permitir incorporação”.'
                : live
                  ? 'A transmissão ainda não começou no YouTube ou o link está incorreto. Aguarde alguns instantes e recarregue.'
                  : 'O vídeo está indisponível no momento. Tente novamente mais tarde.'}
            </p>
          </div>
        </div>
      )}

      {/* Carregando */}
      {started && !ready && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black">
          <span className="size-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        </div>
      )}

      {/* Pausado: só escurece um pouco (cobre sugestões do YouTube); play/pause fica na barra de baixo */}
      {ready && !ytError && !playing && !ended && <div className="pointer-events-none absolute inset-0 z-[15] bg-black/40" />}

      {/* Velocidade: painel na frente do vídeo (fácil de tocar no celular) */}
      {speedOpen && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-sm" onClick={() => setSpeedOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[270px] rounded-2xl border border-white/15 bg-[#0d1527]/95 p-3 text-white shadow-2xl sm:max-w-xs sm:p-4">
            <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-sm font-bold">Velocidade</span>
              <button type="button" onClick={() => setSpeedOpen(false)} aria-label="Fechar" className="grid size-7 place-items-center rounded-lg bg-white/10 hover:bg-white/20">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeSpeed(s)}
                  className={cn('rounded-xl py-2 text-sm font-bold tabular-nums transition', s === speed ? 'bg-brand text-white ring-1 ring-blue-400/50' : 'bg-white/10 hover:bg-white/15')}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fim da aula */}
      {ended && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#070b14]/95 p-6 text-center text-white">
          <span className="grid size-12 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="max-w-md text-base font-bold sm:text-lg">{live ? 'Transmissão encerrada' : title || 'Fim da aula'}</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={play} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20">
              <RotateCcw className="size-4" /> Rever
            </button>
            {onToggleComplete && !live && (
              <button
                type="button"
                onClick={onToggleComplete}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
                  completed ? 'border border-emerald-500/30 bg-emerald-600/30 text-emerald-300' : 'bg-brand hover:bg-brand-strong',
                )}
              >
                <CheckCircle2 className="size-4" /> {completed ? 'Concluída' : 'Concluir aula'}
              </button>
            )}
            {onNext && (
              <button type="button" onClick={onNext} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#070b14] hover:bg-slate-200">
                Próxima aula <SkipForward className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sombra de cima, junto com os controles */}
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 z-30 h-20 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300', barVisible && started ? 'opacity-100' : 'opacity-0')} />

      {/* Barra de controles */}
      {ready && !ytError && (
        <div
          // Mexendo na barra (volume, linha do tempo), os controles continuam na tela
          onPointerDown={scheduleHide}
          onPointerMove={(e) => e.pointerType === 'mouse' && scheduleHide()}
          className={cn(
            'absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-8 transition-opacity duration-300',
            isFull ? 'px-[max(0.75rem,env(safe-area-inset-left))] pb-[max(0.875rem,env(safe-area-inset-bottom))]' : 'px-3 pb-2 sm:px-4 sm:pb-3',
            barVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {/* Linha do tempo (área de toque de 32 px) */}
          <div className={cn('group/seek relative mb-1 flex h-8 items-center', live && 'hidden')}>
            <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 transition-all group-hover/seek:h-1.5">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${buffered}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
            <span className="pointer-events-none absolute size-3.5 -translate-x-1/2 rounded-full bg-white shadow transition-transform group-hover/seek:scale-110" style={{ left: `${pct}%` }} />
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step={1}
              value={shownTime}
              aria-label="Posição do vídeo"
              onChange={(e) => {
                setSeeking(Number(e.target.value));
                scheduleHide();
              }}
              onPointerUp={() => {
                if (seeking !== null) seekTo(seeking);
                setSeeking(null);
              }}
              onKeyUp={() => {
                if (seeking !== null) seekTo(seeking);
                setSeeking(null);
              }}
              className="absolute inset-0 w-full cursor-pointer opacity-0"
            />
          </div>

          <div className="flex items-center gap-1 text-white sm:gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pausar' : 'Reproduzir'}
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand transition hover:bg-brand-strong"
            >
              {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
            </button>
            {!live && (
              <>
                <CtrlBtn label="Voltar 10s" onClick={() => skip(-10)} className="hidden sm:grid">
                  <RotateCcw className="size-[18px]" />
                </CtrlBtn>
                <CtrlBtn label="Avançar 10s" onClick={() => skip(10)} className="hidden sm:grid">
                  <RotateCw className="size-[18px]" />
                </CtrlBtn>
              </>
            )}
            <div className="hidden items-center sm:flex">
              <CtrlBtn label={muted ? 'Ativar som' : 'Silenciar'} onClick={toggleMute}>
                {muted || volume === 0 ? <VolumeX className="size-[18px] text-rose-400" /> : <Volume2 className="size-[18px]" />}
              </CtrlBtn>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="w-16 cursor-pointer accent-[#3b82f6] lg:w-20"
              />
            </div>
            {live ? (
              <button
                type="button"
                onClick={() => {
                  seekTo((playerRef.current?.getDuration?.() || 0) + 60);
                  playerRef.current?.playVideo?.();
                }}
                title="Ir para o ao vivo"
                className="ml-1 flex items-center gap-1.5 rounded-md bg-rose-600/90 px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-white uppercase hover:bg-rose-600"
              >
                <span className="size-2 animate-pulse rounded-full bg-white" /> Ao vivo
              </button>
            ) : (
              <span className="ml-1 shrink-0 text-xs font-medium whitespace-nowrap text-white/85 tabular-nums">
                {formatClock(shownTime)} <span className="text-white/50 max-[360px]:hidden">/ {formatClock(duration)}</span>
              </span>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={toggleCaptions}
              aria-pressed={cc}
              title={cc ? 'Desativar legenda (C)' : 'Ativar legenda (C)'}
              className={cn('flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition', cc ? 'bg-brand text-white' : 'bg-white/10 hover:bg-white/15')}
            >
              <Captions className="size-4" />
              <span className="hidden sm:inline">Legenda</span>
            </button>
            {!live && (
              <button
                type="button"
                onClick={() => setSpeedOpen(true)}
                className="h-10 shrink-0 rounded-lg bg-white/10 px-2.5 text-xs font-bold tabular-nums transition hover:bg-white/15"
                aria-label="Velocidade"
              >
                {speed}x
              </button>
            )}
            {onToggleTheater && !isFull && (
              <CtrlBtn label={theater ? 'Sair do modo cinema (T)' : 'Modo cinema (T)'} onClick={onToggleTheater} className={cn('hidden lg:grid', theater && 'text-blue-300')}>
                <RectangleHorizontal className="size-[18px]" />
              </CtrlBtn>
            )}
            <CtrlBtn label={isFull ? 'Sair da tela cheia' : 'Tela cheia'} onClick={toggleFs}>
              {isFull ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
            </CtrlBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/** Liga/desliga a legenda (prefere português). */
function syncCaptions(p: any, on: boolean) {
  try {
    if (!on) {
      p.setOption?.('captions', 'track', {});
      p.unloadModule?.('captions');
      return;
    }
    p.loadModule?.('captions');
    const apply = () => {
      try {
        const tracks = p.getOption?.('captions', 'tracklist');
        const pt = Array.isArray(tracks)
          ? tracks.find((t: any) => String(t?.languageCode ?? '').startsWith('pt') || /portugu/i.test(String(t?.languageName ?? ''))) || tracks[0]
          : null;
        p.setOption?.('captions', 'track', pt ?? { languageCode: 'pt' });
      } catch {
        /* noop */
      }
    };
    apply();
    [300, 900, 1800].forEach((ms) => window.setTimeout(apply, ms));
  } catch {
    /* noop */
  }
}

function CtrlBtn({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn('grid size-10 shrink-0 place-items-center rounded-lg transition hover:bg-white/15', className)}>
      {children}
    </button>
  );
}
