'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="text-lg font-bold text-ink">Algo deu errado ao carregar esta página</p>
      <p className="mt-1 text-sm text-muted">Pode ter sido uma falha de conexão. Tente novamente.</p>
      <Button className="mt-5" onClick={reset}>
        <RotateCcw className="size-4" /> Tentar de novo
      </Button>
    </div>
  );
}
