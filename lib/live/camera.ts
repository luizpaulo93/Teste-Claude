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

/** Conta os quadros que chegam de verdade durante `ms` (depois do primeiro quadro). */
export function measureFps(track: MediaStreamTrack, ms = 2000): Promise<number> {
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
    const finish = (fps: number) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      v.pause();
      v.srcObject = null;
      v.remove();
      resolve(Math.round(fps));
    };
    // sem nenhum quadro (ou travou no meio): conta o que deu até aqui
    const timer = window.setTimeout(() => finish(first && last > first ? (count * 1000) / (last - first) : 0), ms + 3000);
    const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number) => void) => number }).requestVideoFrameCallback;
    if (!rvfc) {
      // navegador sem contador de quadros: confia no que a câmera informa
      window.setTimeout(() => finish(track.getSettings().frameRate ?? 30), 400);
      return;
    }
    const tick = (now: number) => {
      if (done) return;
      if (!first) first = now;
      else count++;
      last = now;
      if (now - first >= ms) finish((count * 1000) / (now - first));
      else rvfc.call(v, tick);
    };
    rvfc.call(v, tick);
  });
}

async function tryOpen(deviceId: string, w: number, h: number) {
  const base = { deviceId: { exact: deviceId }, width: { ideal: w }, height: { ideal: h }, aspectRatio: { ideal: 16 / 9 } };
  // exige 25 quadros no mínimo; se a câmera recusar o mínimo, tenta só com o ideal
  return navigator.mediaDevices
    .getUserMedia({ video: { ...base, frameRate: { ideal: 30, min: 25 } } })
    .catch(() => navigator.mediaDevices.getUserMedia({ video: { ...base, frameRate: { ideal: 30 } } }));
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

/** O máximo que a câmera informa ter (qualquer câmera; nem todo navegador informa). */
function maxOf(t: MediaStreamTrack) {
  const c = (t.getCapabilities?.() ?? {}) as MediaTrackCapabilities;
  const w = c.width?.max ?? 0;
  const h = c.height?.max ?? 0;
  return { w, h, fps: c.frameRate?.max ?? 0 };
}

/**
 * Abre qualquer câmera no máximo dela: começa pela maior resolução que ela tem (até a da live) e só desce
 * (720p → 576p → 480p) se, naquela resolução, a própria câmera entregar menos de 25 quadros por segundo.
 * Se a câmera promete 30 e quem atrasa é o navegador, fica no máximo (o problema não é a câmera).
 */
export async function openSmoothCamera(deviceId: string, maxHeight: number, isCancelled: () => boolean = () => false): Promise<SmoothCamera> {
  let steps = LADDER.filter(([, h]) => h <= maxHeight);
  let best: { w: number; h: number; fps: number } | null = null;
  let firstTry: { from: number; fps: number } | null = null;
  for (let k = 0; k < steps.length; k++) {
    const [w, h] = steps[k];
    if (isCancelled()) throw new Error('cancelado');
    const s = await tryOpen(deviceId, w, h).catch(() => null);
    if (!s) continue;
    const t = s.getVideoTracks()[0];
    if (k === 0) {
      // primeira vez: o máximo da câmera define por onde começar (sem passar da resolução da live)
      const m = maxOf(t);
      if (m.h && m.w) steps = [[Math.min(m.w, Math.round((maxHeight * 16) / 9)), Math.min(m.h, maxHeight)], ...steps.filter(([, sh]) => sh < Math.min(m.h, maxHeight))];
    }
    const st = t.getSettings();
    const promised = Math.round(st.frameRate ?? 0);
    const fps = await measureFps(t);
    const real = { w: st.width ?? w, h: st.height ?? h, fps };
    if (!firstTry) firstTry = { from: Math.min(real.w, real.h), fps: promised && promised < fps ? promised : fps };
    // fluida: contou 25+; ou a câmera está num modo de 25+ e o atraso é do navegador (não desce à toa)
    if (fps >= SMOOTH_FPS || (promised >= SMOOTH_FPS && fps >= 12)) {
      const stepped = firstTry.from !== Math.min(real.w, real.h) ? firstTry : null;
      return { stream: s, width: real.w, height: real.h, fps: Math.max(fps, Math.min(promised, 30)), stepped };
    }
    if (!best || fps > best.fps) best = real;
    // a mesma câmera aberta duas vezes trava no iPad: fecha antes de tentar a próxima
    s.getTracks().forEach((x) => x.stop());
  }
  if (isCancelled()) throw new Error('cancelado');
  // nenhuma ficou fluida: abre a que deu mais quadros (ou do jeito que a câmera quiser)
  const s = best
    ? await tryOpen(deviceId, best.w, best.h)
    : await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, frameRate: { ideal: 30 } } });
  const st = s.getVideoTracks()[0].getSettings();
  return { stream: s, width: st.width ?? 0, height: st.height ?? 0, fps: best?.fps ?? Math.round(st.frameRate ?? 0), stepped: firstTry };
}
