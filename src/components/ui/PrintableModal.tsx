import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** A4/letter "page" rendered inside the modal and used by window.print(). */
  children: ReactNode;
};

/**
 * Modal that wraps a printable document. The actions bar (Imprimir / Cerrar)
 * has `.no-print` so window.print() only outputs the document inside .printable.
 */
export function PrintableModal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 px-4 py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col overflow-hidden rounded-card bg-sand-l shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="no-print flex shrink-0 items-center justify-between border-b border-sand bg-white px-6 py-3">
          <h2 className="font-heading text-base font-semibold text-dark">{title ?? 'Documento'}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d"
            >
              🖨 Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-sand px-3 py-1.5 text-xs font-semibold text-dark-2 hover:bg-sand-l"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-6">
          <div className="printable mx-auto max-w-3xl rounded-md bg-white shadow-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
