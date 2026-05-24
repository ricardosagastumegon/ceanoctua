import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

type PlaceholderProps = { name: string };

export function Placeholder({ name }: PlaceholderProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-card border border-sand bg-white p-8 shadow-sm">
      <h1 className="font-heading text-2xl font-semibold text-dark">{name}</h1>
      <p className="mt-2 text-dark-2">En construcción — Fase 1</p>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-d"
        >
          Probar Modal
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`${name} — demo`}>
        <p className="text-dark-2">
          Este es el componente <code>&lt;Modal&gt;</code> base. Reemplaza los 56 modales sueltos
          del HTML original. Ciérralo con el botón ✕, el overlay, o tecla{' '}
          <kbd className="rounded border border-sand px-1">Esc</kbd>.
        </p>
      </Modal>
    </section>
  );
}
