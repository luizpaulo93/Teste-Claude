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
  try {
    const url = URL.createObjectURL(
      new Blob([`let id = 0; onmessage = (e) => { clearInterval(id); if (e.data > 0) id = setInterval(() => postMessage(0), e.data); };`], {
        type: 'text/javascript',
      }),
    );
    const worker = new Worker(url);
    worker.onmessage = () => fn();
    worker.postMessage(clamp(ms));
    return {
      set: (n) => worker.postMessage(clamp(n)),
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
