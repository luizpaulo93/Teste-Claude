/**
 * Câmera fluida: a maior resolução em que a câmera entrega de verdade pelo menos ~24 quadros por segundo.
 *
 * Por quê: muitas webcams USB, no iPad, entram num modo de 1080p sem compressão em que o USB só dá conta de
 * ~5 quadros por segundo — a imagem trava e deixa "fantasmas". Vale para qualquer câmera: o máximo dela é
 * pedido primeiro e só se desce quando a própria câmera, naquela resolução, não chega a 25 quadros.
 * O navegador informa o que a câmera promete, não o que entrega; por isso os quadros são contados.
 */

// degraus padrão de qualquer webcam (16:9 e o 640×480 que toda câmera tem); o primeiro é o máximo da câmera
const LADDER: [number, number][] = [
  [1920, 1080],
  [1280, 720],
  [1024, 576],
  [864, 480],
  [640, 480],
];
/** abaixo disso a imagem treme: só aceita a câmera a partir de 25 quadros por segundo (o normal é 30) */
export const SMOOTH_FPS = 25;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Conta os quadros que chegam de verdade durante `ms` depois do primeiro quadro.
 * Câmera USB demora a "acordar": espera o primeiro quadro por até `firstWait` (sem nenhum = 0).
 */
export function measureFps(track: MediaStreamTrack, ms = 2000, firstWait = 7000): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.setAttribute('playsinline', '');
    // visível (mas imperceptível): o Safari não entrega quadros de vídeo fora da página
    v.style.cssText = 'position:fixed;left:0;top:0;width:160px;height:90px;opacity:0.01;pointer-events:none;z-index:-1';
    v.srcObject = new MediaStream([track]);
    document.body.appendChild(v);
    void v.play().catch(() => {});
    let first = 0;
    let last = 0;
    let count = 0;
    let done = false;
    let timer = 0;
    const finish = (fps: number) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      v.pause();
      v.srcObject = null;
      v.remove();
      resolve(Math.round(fps));
    };
    // nenhum quadro contado até aqui: se mesmo assim a imagem chegou ao vídeo (o navegador só não avisou cada
    // quadro), vale o que a câmera informa; senão a câmera não está mandando imagem neste modo
    timer = window.setTimeout(() => finish(v.readyState >= 2 && v.videoWidth > 0 ? (track.getSettings().frameRate ?? 30) : 0), firstWait);
    const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number) => void) => number }).requestVideoFrameCallback;
    if (!rvfc) {
      // navegador sem contador de quadros: espera a imagem aparecer e confia no que a câmera informa
      const poll = window.setInterval(() => {
        if (done) return window.clearInterval(poll);
        if (v.readyState >= 2 && v.videoWidth > 0) {
          window.clearInterval(poll);
          finish(track.getSettings().frameRate ?? 30);
        }
      }, 100);
      return;
    }
    const tick = (now: number) => {
      if (done) return;
      if (!first) {
        first = now;
        // chegou o primeiro: agora conta durante `ms` (se travar no meio, fecha com o que deu)
        window.clearTimeout(timer);
        timer = window.setTimeout(() => finish(last > first ? (count * 1000) / (last - first) : 0), ms + 1500);
      } else count++;
      last = now;
      if (now - first >= ms) finish((count * 1000) / (now - first));
      else rvfc.call(v, tick);
    };
    rvfc.call(v, tick);
  });
}

/** Pedidos de abertura: resolução (ou o modo padrão da câmera, sem impor nada) */
type Ask = { w: number; h: number } | 'padrao';

async function openAsk(deviceId: string, a: Ask) {
  if (a === 'padrao') return navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
  // sem taxa mínima obrigatória: em alguns iPads a webcam USB num modo forçado não manda imagem nenhuma
  return navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId }, width: { ideal: a.w }, height: { ideal: a.h }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30 } },
  });
}

export interface SmoothCamera {
  stream: MediaStream;
  width: number;
  height: number;
  /** quadros por segundo contados */
  fps: number;
  /** desceu de resolução para ficar fluida (ex.: 1080p só saía a 5 fps) */
  stepped: { from: number; fps: number } | null;
}

/**
 * Abre qualquer câmera no máximo dela que fique fluido:
 *  1. a maior resolução (até a da live);
 *  2. se não vier imagem nenhuma, o modo padrão da própria câmera (sem impor resolução nem taxa);
 *  3. resoluções menores (720p, 576p, 480p).
 * Aceita a primeira que entrega 25+ quadros por segundo (ou que promete 25+ e só o navegador atrasa).
 * Entre uma tentativa e outra espera a câmera ser liberada (no iPad, reabrir na hora trava a webcam USB).
 */
export async function openSmoothCamera(deviceId: string, maxHeight: number, isCancelled: () => boolean = () => false): Promise<SmoothCamera> {
  const ladder = LADDER.filter(([, h]) => h <= maxHeight);
  const queue: Ask[] = [{ w: ladder[0][0], h: ladder[0][1] }];
  let best: { ask: Ask; w: number; h: number; fps: number } | null = null;
  let firstTry: { from: number; fps: number } | null = null;
  let triedDefault = false;
  const tried = new Set<string>();
  while (queue.length) {
    const ask = queue.shift()!;
    if (isCancelled()) throw new Error('cancelado');
    const s = await openAsk(deviceId, ask).catch(() => null);
    if (!s) continue;
    const t = s.getVideoTracks()[0];
    const st = t.getSettings();
    const promised = Math.round(st.frameRate ?? 0);
    const fps = await measureFps(t);
    const real = { w: st.width ?? 0, h: st.height ?? 0, fps };
    tried.add(`${real.w}x${real.h}`);
    if (!firstTry) firstTry = { from: Math.min(real.w, real.h) || (ask === 'padrao' ? 0 : ask.h), fps };
    if (fps > 0 && (fps >= SMOOTH_FPS || (promised >= SMOOTH_FPS && fps >= 12))) {
      const stepped = firstTry.from !== Math.min(real.w, real.h) ? firstTry : null;
      return { stream: s, width: real.w, height: real.h, fps: Math.max(fps, Math.min(promised, 30)), stepped };
    }
    if (fps > 0 && (!best || fps > best.fps)) best = { ask, ...real };
    s.getTracks().forEach((x) => x.stop());
    // a câmera precisa de um instante para ser liberada antes de abrir de novo
    await sleep(700);
    // próximos pedidos: sem imagem nenhuma → o modo padrão da câmera; depois, resoluções menores que a atual
    if (!triedDefault && fps === 0) {
      triedDefault = true;
      queue.unshift('padrao');
    }
    if (!queue.length) {
      const cur = Math.min(real.h || 9999, ask === 'padrao' ? 9999 : ask.h);
      for (const [w, h] of ladder) if (h < cur && !tried.has(`${w}x${h}`) && !queue.some((q) => q !== 'padrao' && q.h === h)) queue.push({ w, h });
      if (!queue.length && !triedDefault) {
        triedDefault = true;
        queue.push('padrao');
      }
    }
  }
  if (isCancelled()) throw new Error('cancelado');
  if (!best) throw new Error('sem imagem');
  // nenhuma ficou fluida: abre a que deu mais quadros
  const s = await openAsk(deviceId, best.ask);
  const st = s.getVideoTracks()[0].getSettings();
  return { stream: s, width: st.width ?? best.w, height: st.height ?? best.h, fps: best.fps, stepped: firstTry };
}
