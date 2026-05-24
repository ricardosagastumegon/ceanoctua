import { useCallback, useEffect, useRef, type ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Confirm-on-close when the embedded form has unsaved changes.
  // We treat any input/select/textarea descendant whose value differs
  // from its initial defaultValue as "dirty".
  const tryClose = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return onClose();
    const inputs = body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select',
    );
    let dirty = false;
    for (const el of inputs) {
      if (el.disabled) continue;
      if (el instanceof HTMLInputElement) {
        if (el.type === 'hidden' || el.readOnly) continue;
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked !== el.defaultChecked) {
            dirty = true;
            break;
          }
        } else if (el.value !== el.defaultValue) {
          dirty = true;
          break;
        }
      } else if (el instanceof HTMLTextAreaElement) {
        if (el.readOnly) continue;
        if (el.value !== el.defaultValue) {
          dirty = true;
          break;
        }
      } else if (el instanceof HTMLSelectElement) {
        // <select> no expone defaultValue; comparamos value vs option default selected.
        const def = Array.from(el.options).find((o) => o.defaultSelected)?.value ?? el.options[0]?.value ?? '';
        if (el.value !== def) {
          dirty = true;
          break;
        }
      }
    }
    if (dirty) {
      const ok = window.confirm('Tienes cambios sin guardar. ¿Cerrar de todas formas?');
      if (!ok) return;
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, tryClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 px-4 py-8"
      onClick={tryClose}
      role="presentation"
    >
      <div
        className={`flex max-h-[calc(100vh-4rem)] w-full ${sizeMap[size]} flex-col overflow-hidden rounded-card bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-sand px-6 py-4">
          {title ? (
            <h2 id="modal-title" className="font-heading text-lg font-semibold text-dark">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={tryClose}
            aria-label="Cerrar"
            className="rounded-full px-2 py-1 text-dark-2 hover:bg-sand-l hover:text-dark"
          >
            ✕
          </button>
        </div>
        <div ref={bodyRef} className="overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
