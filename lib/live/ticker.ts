/**
 * Relógio que continua batendo com a aba em segundo plano.
 * Os timers da página são freados pelo navegador quando você troca de janela (ex.: para mostrar
 * a tela); os de um Worker não. Essencial para a live não travar ao espelhar outra janela.
 */
export interface Ticker {
  /** muda o ritmo sem criar outro relógio (a taxa de quadros adaptativa muda a cada segundo) */
  set(ms: number): void;
  stop(): void;
}

export function workerTicker(ms: number, fn: () => void): Ticker {
  const clamp = (n: number) => Math.max(5, Math.round(n));
  let every = clamp(ms);
  // Folga para a tela: se o aparelho não dá conta do ritmo, as batidas atrasadas são puladas (em vez de
  // fazerem fila e ocuparem o aparelho sem parar) e depois de cada quadro sobra um respiro para o toque e a
  // caneta serem atendidos. Sem isso a escrita "parava" por instantes durante a live.
  let freeAt = 0;
  const run = (sentAt: number) => {
    if (Date.now() - sentAt > Math.max(30, every)) return; // batida velha: já vem outra atrás
    const t0 = performance.now();
    if (t0 < freeAt) return;
    fn();
    const took = performance.now() - t0;
    freeAt = performance.now() + Math.min(16, took * 0.4);
  };
  try {
    const url = URL.createObjectURL(
      new Blob([`let id = 0; onmessage = (e) => { clearInterval(id); if (e.data > 0) id = setInterval(() => postMessage(Date.now()), e.data); };`], {
        type: 'text/javascript',
      }),
    );
    const worker = new Worker(url);
    worker.onmessage = (e) => run(typeof e.data === 'number' && e.data > 0 ? e.data : Date.now());
    worker.postMessage(every);
    return {
      set: (n) => {
        every = clamp(n);
        worker.postMessage(every);
      },
      stop: () => {
        worker.terminate();
        URL.revokeObjectURL(url);
      },
    };
  } catch {
    let id = window.setInterval(fn, ms);
    return {
      set: (n) => {
        window.clearInterval(id);
        id = window.setInterval(fn, n);
      },
      stop: () => window.clearInterval(id),
    };
  }
}
