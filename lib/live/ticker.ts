/**
 * Relógio que continua batendo com a aba em segundo plano.
 * Os timers da página são freados pelo navegador quando você troca de janela (ex.: para mostrar
 * a tela); os de um Worker não. Essencial para a live não travar ao espelhar outra janela.
 */
export function workerTicker(ms: number, fn: () => void): () => void {
  let worker: Worker | null = null;
  let url = '';
  try {
    url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${Math.max(5, Math.round(ms))});`], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = () => fn();
  } catch {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  }
  return () => {
    worker?.terminate();
    URL.revokeObjectURL(url);
  };
}
