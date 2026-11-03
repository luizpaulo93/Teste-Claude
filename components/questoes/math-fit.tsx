'use client';

import { useEffect } from 'react';

/**
 * Fórmula que não cabe na largura da tela (e não tem onde quebrar linha) rola para o lado
 * dentro da própria linha, em vez de empurrar a página para fora da tela.
 */
export function MathFit() {
  useEffect(() => {
    const fit = () => {
      for (const el of document.querySelectorAll<HTMLElement>('.q-rich .katex .katex-base, .q-rich .katex .base')) {
        const box = el.closest('.q-rich') as HTMLElement | null;
        if (!box) continue;
        el.classList.remove('q-wide');
        if (el.getBoundingClientRect().width > box.clientWidth) el.classList.add('q-wide');
      }
    };
    fit();
    let t = 0;
    const later = () => {
      window.clearTimeout(t);
      t = window.setTimeout(fit, 60);
    };
    window.addEventListener('resize', later);
    // a resolução aparece depois de responder
    const mo = new MutationObserver(later);
    const main = document.querySelector('main');
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', later);
      mo.disconnect();
      window.clearTimeout(t);
    };
  }, []);
  return null;
}
