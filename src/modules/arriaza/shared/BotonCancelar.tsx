import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { invalidarViaje } from '../viajes/invalidar';
import {
  cancelarServicio,
  netoServicio,
  reactivarServicio,
  type TablaServicio,
} from './cancelacion';

type Props = {
  tabla: TablaServicio;
  viajeId: string;
  servicio: {
    id: string;
    nombre: string;
    monto: number | null;
    moneda: string | null;
    estado_pago: string | null;
    reintegro: number | null;
    reintegro_nota: string | null;
  };
  /** Para refrescar la lista propia de la sección. */
  onDone: () => void;
};

type Respuesta = 'total' | 'parcial' | 'ninguno';

/**
 * Cancelar un servicio preguntando por el reintegro.
 *
 * Cancelar no es borrar. Un servicio cancelado sigue en el viaje y en la
 * liquidación, porque si el reintegro fue parcial ese dinero se gastó y tiene
 * que verse.
 */
export function BotonCancelar({ tabla, viajeId, servicio, onDone }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [respuesta, setRespuesta] = useState<Respuesta>('total');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cancelado = servicio.estado_pago === 'CANCELADO';
  const cargo = Number(servicio.monto) || 0;
  const moneda = servicio.moneda ?? 'USD';

  function abrir() {
    setRespuesta('total');
    setMonto(cargo.toFixed(2));
    setNota('');
    setAbierto(true);
  }

  function elegir(r: Respuesta) {
    setRespuesta(r);
    // El reintegro total es el cargo completo; no hay nada que escribir.
    if (r === 'total') setMonto(cargo.toFixed(2));
    if (r === 'ninguno') setMonto('');
    if (r === 'parcial' && Number(monto) === cargo) setMonto('');
  }

  const reintegro =
    respuesta === 'total' ? cargo
      : respuesta === 'parcial' ? Number(monto) || 0
        : 0;
  const neto = cargo - reintegro;
  const excede = respuesta === 'parcial' && reintegro > cargo;

  async function confirmar() {
    if (excede) return;
    setGuardando(true);
    try {
      await cancelarServicio(tabla, servicio.id, {
        reintegro: reintegro > 0 ? reintegro : null,
        nota: nota.trim() || null,
      });
      invalidarViaje(qc, viajeId);
      onDone();
      setAbierto(false);
      toast.success(
        reintegro > 0
          ? `Servicio cancelado · reintegro de ${moneda} ${reintegro.toFixed(2)}.`
          : 'Servicio cancelado sin reintegro.',
      );
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function reactivar() {
    setGuardando(true);
    try {
      await reactivarServicio(tabla, servicio.id);
      invalidarViaje(qc, viajeId);
      onDone();
      toast.success('Servicio reactivado.');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  if (cancelado) {
    return (
      <button
        type="button"
        onClick={() => void reactivar()}
        disabled={guardando}
        className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal disabled:opacity-50"
        title={
          servicio.reintegro
            ? `Cancelado · reintegro de ${moneda} ${Number(servicio.reintegro).toFixed(2)}. Clic para reactivar.`
            : 'Cancelado sin reintegro. Clic para reactivar.'
        }
      >
        ↩
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust"
        title="Cancelar servicio"
      >
        ✕
      </button>

      <Modal open={abierto} onClose={() => setAbierto(false)} title="Cancelar servicio" size="md">
        <div className="space-y-4">
          <p className="text-sm text-dark-2">
            Vas a cancelar <strong>{servicio.nombre}</strong>, que se pagó con{' '}
            <strong>{moneda} {cargo.toFixed(2)}</strong>.
          </p>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">
              ¿Hubo reintegro?
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {([
                ['total', 'Total', 'Devolvieron todo'],
                ['parcial', 'Parcial', 'Devolvieron una parte'],
                ['ninguno', 'Ninguno', 'No devolvieron nada'],
              ] as const).map(([valor, titulo, pie]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => elegir(valor)}
                  className={
                    respuesta === valor
                      ? 'rounded-md border-2 border-teal bg-teal-l px-3 py-2 text-sm font-extrabold text-teal-d'
                      : 'rounded-md border border-sand bg-white px-3 py-2 text-sm font-semibold text-dark-3 hover:border-teal/50'
                  }
                >
                  {titulo}
                  <span className="block text-[10px] font-semibold normal-case">{pie}</span>
                </button>
              ))}
            </div>
          </div>

          {respuesta === 'parcial' && (
            <TextInput
              label={`¿Cuánto devolvieron? (${moneda})`}
              type="number"
              min="0"
              max={cargo}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
            />
          )}

          <TextArea
            label="Nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Número de nota de crédito, motivo de la cancelación…"
          />

          {excede && (
            <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">
              El reintegro no puede ser mayor a lo que se pagó.
            </div>
          )}

          {/* Lo que de verdad quedó costando, que es lo que sumará el viaje. */}
          <div className="rounded-md border border-sand bg-sand-l px-4 py-3 text-sm">
            <div className="flex justify-between text-dark-2">
              <span>Se pagó</span>
              <span className="font-semibold">{moneda} {cargo.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-dark-2">
              <span>Reintegro</span>
              <span className="font-semibold">− {moneda} {reintegro.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-sand pt-1 font-heading font-extrabold text-dark">
              <span>Costó al viaje</span>
              <span>{moneda} {neto.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={guardando || excede}
              className="rounded-md bg-rust px-4 py-2 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Cancelar servicio'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export { netoServicio };
