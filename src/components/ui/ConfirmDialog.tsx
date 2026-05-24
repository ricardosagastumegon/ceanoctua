import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal } from './Modal';

type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function resolve(value: boolean) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={open}
        onClose={() => resolve(false)}
        title={opts?.title ?? 'Confirmar'}
        size="sm"
      >
        <div className="text-sm text-dark-2">{opts?.message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => resolve(false)}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            {opts?.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => resolve(true)}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm ${
              opts?.danger ? 'bg-rust hover:bg-rust/90' : 'bg-teal hover:bg-teal-d'
            }`}
          >
            {opts?.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
