import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { fmtDate } from '@/modules/arriaza/utils';
import type { RegistroCompleto } from './api';

type Props = {
  registro: RegistroCompleto;
  onClose: () => void;
  onConfirm: (nota: string) => Promise<void>;
};

/**
 * Anular un registro de combustible, preguntando por el motivo.
 *
 * Anular no es borrar. El registro se queda en la lista con su historial
 * —muchas veces hay una solicitud de pago que lo menciona— pero deja de sumar
 * al total facturado. El motivo es lo que después explica por qué el total del
 * mes no cuadra con las facturas.
 */
export function AnularModal({ registro: r, onClose, onConfirm }: Props) {
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    setGuardando(true);
    try {
      await onConfirm(nota);
      onClose();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Anular registro de combustible">
      <div className="space-y-4">
        <p className="text-sm text-dark-2">
          El registro <b>{r.serial ?? ''}</b> del {fmtDate(r.fecha)} se queda en la lista con su
          historial, pero deja de sumar al total facturado.
        </p>

        {r.pago_serial && (
          <p className="rounded-md border border-gold/40 bg-gold-light px-3 py-2 text-[12px] text-dark-2">
            Este registro tiene la solicitud <b>{r.pago_serial}</b>. Anularlo acá{' '}
            <b>no la toca</b>: esa se maneja desde Finanzas → Pagos.
          </p>
        )}

        <TextInput
          label="Motivo"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: factura duplicada"
          hint="Opcional, pero es lo que explica después por qué el total no cuadra."
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={guardando}
            className="rounded-md bg-rust px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {guardando ? 'Anulando…' : 'Anular registro'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
