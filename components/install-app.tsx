'use client';

import { Download, Share, SquarePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { Modal } from '@/components/ui-client';
import { cn } from '@/lib/utils';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BIPEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    subs.forEach((f) => f());
  });
}

/** Botão para instalar a plataforma como aplicativo (Android/desktop) ou instruções no iPhone. */
export function InstallApp({ className, compact }: { className?: string; compact?: boolean }) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
    setInstalled(Boolean(standalone));
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const update = () => setCanPrompt(Boolean(deferred));
    update();
    subs.add(update);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      subs.delete(update);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!canPrompt && !ios)) return null;

  const click = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      setCanPrompt(false);
    } else setHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={click}
        className={cn(
          compact
            ? 'flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-2 p-4 text-xs font-semibold text-ink-2'
            : 'flex w-full items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2.5 text-left text-sm font-semibold text-brand transition hover:bg-brand/20',
          className,
        )}
      >
        <Download className="size-5 shrink-0" />
        <span>{compact ? 'Instalar app' : 'Instalar aplicativo'}</span>
      </button>
      <Modal open={help} onClose={() => setHelp(false)} title="Instalar no iPhone" size="sm">
        <div className="flex flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-accent text-white shadow-glow">
            <Logo className="size-9" />
          </span>
          <ol className="mt-5 space-y-3 text-left text-sm text-ink-2">
            <li className="flex items-center gap-2">
              1. Toque em <Share className="size-4 text-brand" /> <strong className="text-ink">Compartilhar</strong> no Safari
            </li>
            <li className="flex items-center gap-2">
              2. Escolha <SquarePlus className="size-4 text-brand" /> <strong className="text-ink">Adicionar à Tela de Início</strong>
            </li>
            <li>3. Pronto! O Vértice abre como um aplicativo.</li>
          </ol>
        </div>
      </Modal>
    </>
  );
}
