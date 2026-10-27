'use client';

import { useState, type ComponentProps } from 'react';

/** Imagem que some (mostrando o fundo atrás) se o arquivo não carregar. */
export function SafeImg({ alt = '', ...props }: ComponentProps<'img'>) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} loading="lazy" decoding="async" onError={() => setOk(false)} {...props} />;
}
