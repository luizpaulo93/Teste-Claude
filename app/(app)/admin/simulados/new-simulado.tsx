'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui-client';
import { SimuladoForm } from './simulado-form';

export function NewSimuladoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Novo simulado
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo simulado" size="lg">
        <SimuladoForm onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}
