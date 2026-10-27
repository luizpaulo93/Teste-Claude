'use client';

import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
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
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export interface VideoPlayerProps {
  videoId: string;
  poster?: string;
  watermark?: string;
  startAt?: number;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
  nextHref?: string;
  onNext?: () => void;
  /** Transmissão ao vivo: esconde a linha do tempo e mostra o selo AO VIVO. */
  live?: boolean;
}

export function VideoPlayer({ videoId, poster, watermark, startAt = 0, onProgress, onEnded, onNext, live }: VideoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const tickRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  onProgressRef.current = onProgress;
  onEndedRef.current = onEnded;

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
  const [fs, setFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [controls, setControls] = useState(true);
  const [seeking, setSeeking] = useState<number | null>(null);
  const [wmPos, setWmPos] = useState(0);
  const [ytError, setYtError] = useState<number | null>(null);

  // Limpa o player ao trocar de aula
  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    setStarted(false);
    setReady(false);
    setPlaying(false);
    setEnded(false);
    setTime(startAt > 3 ? startAt : 0);
    setDuration(0);
    setYtError(null);
  }, [videoId, startAt]);

  // Marca d'água muda de posição a cada 15 s
  useEffect(() => {
    if (!watermark) return;
    const t = window.setInterval(() => setWmPos((p) => (p + 1 + Math.floor(Math.random() * 4)) % 6), 15000);
    return () => window.clearInterval(t);
  }, [watermark]);

  const showControls = useCallback(() => {
    setControls(true);
    if (hideRef.current) window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => {
      if (playerRef.current?.getPlayerState?.() === 1) setControls(false);
    }, 2800);
  }, []);

  const start = useCallback(async () => {
    setStarted(true);
    const YT = await loadYouTubeApi();
    if (!mountRef.current) return;
    const el = document.createElement('div');
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(el);
    playerRef.current = new YT.Player(el, {
      videoId,
      host: 'https://www.youtube-nocookie.com',
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        start: !live && startAt > 3 ? Math.floor(startAt) : 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (e: any) => {
          setReady(true);
          setDuration(e.target.getDuration() || 0);
          e.target.playVideo();
        },
        onError: (e: any) => {
          setYtError(Number(e.data) || 1);
          setReady(true);
        },
        onStateChange: (e: any) => {
          const st = e.data;
          setPlaying(st === 1);
          if (st === 1) {
            setEnded(false);
            setDuration(e.target.getDuration() || 0);
            showControls();
          }
          if (st === 2) setControls(true);
          if (st === 0) {
            setEnded(true);
            setControls(true);
            onEndedRef.current?.();
          }
        },
      },
    });

    let lastReport = 0;
    tickRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime() || 0;
      const d = p.getDuration() || 0;
      setTime(t);
      if (d) setDuration(d);
      setBuffered((p.getVideoLoadedFraction?.() || 0) * 100);
      if (p.getPlayerState?.() === 1 && Math.abs(t - lastReport) >= 15) {
        lastReport = t;
        onProgressRef.current?.(Math.floor(t), Math.floor(d));
      }
    }, 500);
  }, [videoId, startAt, showControls, live]);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!started) return void start();
    if (!p?.getPlayerState) return;
    if (p.getPlayerState() === 1) {
      p.pauseVideo();
      onProgressRef.current?.(Math.floor(p.getCurrentTime() || 0), Math.floor(p.getDuration() || 0));
    } else p.playVideo();
  }, [started, start]);

  const seekTo = useCallback((sec: number) => {
    const p = playerRef.current;
    if (!p?.seekTo) return;
    const d = p.getDuration() || 0;
    const s = Math.max(0, Math.min(d ? d - 0.5 : sec, sec));
    p.seekTo(s, true);
    setTime(s);
  }, []);

  const skip = useCallback((delta: number) => seekTo((playerRef.current?.getCurrentTime?.() || 0) + delta), [seekTo]);

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  };

  const changeVolume = (v: number) => {
    const p = playerRef.current;
    setVolume(v);
    if (!p) return;
    p.setVolume(v);
    if (v > 0 && p.isMuted()) {
      p.unMute();
      setMuted(false);
    }
  };

  const changeSpeed = (s: number) => {
    playerRef.current?.setPlaybackRate?.(s);
    setSpeed(s);
    setSpeedOpen(false);
  };

  const toggleFs = useCallback(() => {
    const el = wrapRef.current as any;
    if (!el) return;
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
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

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight' || e.key === 'l') skip(10);
      else if (e.key === 'ArrowLeft' || e.key === 'j') skip(-10);
      else if (e.key === 'f') toggleFs();
      else if (e.key === 'm') toggleMute();
      else return;
      showControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shownTime = seeking ?? time;
  const pct = duration ? (shownTime / duration) * 100 : 0;
  const isFull = fs || pseudoFs;
  const WM = [
    'top-[8%] left-[4%]',
    'top-[14%] right-[4%]',
    'top-[44%] left-[4%]',
    'top-[48%] right-[4%]',
    'bottom-[22%] left-[4%]',
    'bottom-[26%] right-[4%]',
  ];

  return (
    <div
      ref={wrapRef}
      onMouseMove={started ? showControls : undefined}
      onTouchStart={started ? showControls : undefined}
      className={cn(
        'group/player relative overflow-hidden bg-black select-none',
        pseudoFs ? 'fixed inset-0 z-[100]' : 'aspect-video w-full rounded-none sm:rounded-2xl',
        isFull && !controls && playing && 'cursor-none',
      )}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={mountRef} className="absolute inset-0 [&>iframe]:size-full [&>iframe]:pointer-events-none" />

      {/* Camada que captura cliques (impede abrir o YouTube) */}
      {started && <div className="absolute inset-0 z-10" onClick={toggle} onDoubleClick={toggleFs} />}

      {watermark && started && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute z-20 max-w-[80%] truncate text-[10px] font-semibold text-white/25 transition-all duration-1000 sm:text-xs',
            WM[wmPos],
          )}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }}
        >
          {watermark}
        </div>
      )}

      {/* Capa antes de começar */}
      {!started && (
        <button type="button" onClick={start} className="group absolute inset-0 z-30 cursor-pointer" aria-label="Reproduzir aula">
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full bg-brand text-white shadow-[0_0_0_10px_rgba(59,130,246,0.25)] transition-transform group-hover:scale-110 sm:size-20">
              <Play className="ml-1 size-7 fill-current sm:size-8" />
            </span>
          </span>
          {live && (
            <span className="absolute top-4 left-4 flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
            </span>
          )}
          {startAt > 3 && !live && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
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

      {/* Pausado: cobre sugestões do YouTube */}
      {ready && !playing && !ended && (
        <button type="button" onClick={toggle} className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-[2px]" aria-label="Continuar">
          <span className="grid size-16 place-items-center rounded-full bg-white/95 text-black transition-transform hover:scale-110">
            <Play className="ml-1 size-7 fill-current" />
          </span>
        </button>
      )}

      {/* Fim */}
      {ended && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 p-6 text-center text-white backdrop-blur-sm">
          <p className="text-lg font-bold">{live ? 'Transmissão encerrada' : 'Aula concluída 🎉'}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => { seekTo(0); playerRef.current?.playVideo(); }} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20">
              <RotateCcw className="size-4" /> Rever
            </button>
            {onNext && (
              <button type="button" onClick={onNext} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold hover:bg-brand-strong">
                Próxima aula <SkipForward className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barra de controles */}
      {ready && (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-10 pb-2 transition-opacity duration-300 sm:px-4 sm:pb-3',
            controls || !playing ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {/* Linha do tempo */}
          <div className={cn('group/seek relative mb-1.5 flex h-5 items-center', live && 'hidden')}>
            <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 transition-all group-hover/seek:h-1.5">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${buffered}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
            <span
              className="pointer-events-none absolute size-3.5 -translate-x-1/2 rounded-full bg-white shadow transition-transform group-hover/seek:scale-110"
              style={{ left: `${pct}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step={1}
              value={shownTime}
              aria-label="Posição do vídeo"
              onChange={(e) => setSeeking(Number(e.target.value))}
              onMouseUp={() => { if (seeking !== null) seekTo(seeking); setSeeking(null); }}
              onTouchEnd={() => { if (seeking !== null) seekTo(seeking); setSeeking(null); }}
              onKeyUp={() => { if (seeking !== null) seekTo(seeking); setSeeking(null); }}
              className="absolute inset-0 w-full cursor-pointer opacity-0"
            />
          </div>

          <div className="flex items-center gap-1 text-white sm:gap-2">
            <CtrlBtn label={playing ? 'Pausar' : 'Reproduzir'} onClick={toggle}>
              {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
            </CtrlBtn>
            <CtrlBtn label="Voltar 10s" onClick={() => skip(-10)}>
              <RotateCcw className="size-[18px]" />
            </CtrlBtn>
            <CtrlBtn label="Avançar 10s" onClick={() => skip(10)}>
              <RotateCw className="size-[18px]" />
            </CtrlBtn>
            <div className="group/vol hidden items-center sm:flex">
              <CtrlBtn label={muted ? 'Ativar som' : 'Silenciar'} onClick={toggleMute}>
                {muted || volume === 0 ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
              </CtrlBtn>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="w-0 cursor-pointer accent-white opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100"
              />
            </div>
            {live ? (
              <button
                type="button"
                onClick={() => seekTo((playerRef.current?.getDuration?.() || 0) + 60)}
                title="Ir para o ao vivo"
                className="ml-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-white hover:bg-white/15"
              >
                <span className={cn('size-2 rounded-full', duration - time < 30 ? 'bg-red-500' : 'bg-white/50')} /> AO VIVO
              </button>
            ) : (
              <span className="ml-1 text-xs font-medium text-white/85 tabular-nums">
                {formatClock(shownTime)} <span className="text-white/50">/ {formatClock(duration)}</span>
              </span>
            )}
            <div className="flex-1" />
            <div className={cn('relative', live && 'hidden')}>
              <button
                type="button"
                onClick={() => setSpeedOpen((v) => !v)}
                className="rounded-lg px-2 py-1.5 text-xs font-bold text-white hover:bg-white/15"
                aria-label="Velocidade"
              >
                {speed}x
              </button>
              {speedOpen && (
                <div className="absolute right-0 bottom-10 w-28 overflow-hidden rounded-xl border border-white/10 bg-black/90 py-1 backdrop-blur">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => changeSpeed(s)}
                      className={cn('block w-full px-3 py-1.5 text-left text-xs hover:bg-white/10', s === speed ? 'font-bold text-brand' : 'text-white')}
                    >
                      {s === 1 ? 'Normal' : `${s}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <CtrlBtn label={isFull ? 'Sair da tela cheia' : 'Tela cheia'} onClick={toggleFs}>
              {isFull ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
            </CtrlBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function CtrlBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-9 place-items-center rounded-lg transition hover:bg-white/15">
      {children}
    </button>
  );
}
