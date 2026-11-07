import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/dates';
import { describeError } from '@/modules/admin/hooks';
import { ExpedienteDeLaSP } from '@/modules/finanzas/pagos/ExpedienteDeLaSP';
import { SolicitudPagoPrintable } from '@/modules/finanzas/pagos/SolicitudPagoPrintable';
import { BotonSPConAdjuntos } from '@/modules/finanzas/pagos/SPConAdjuntos';
import type { Pago } from '@/modules/finanzas/pagos/api';
import { useFirmarDocumento } from './hooks';
import type { Firma } from './api';

/**
 * Firmar, con el documento y su respaldo delante.
 *
 * POR QUE EXISTE. Firmar vivia dentro de CEA -> Firmas, que es el modulo de
 * quien ORGANIZA las firmas. Mientras la unica que firmaba era quien ademas
 * lo organizaba, coincidia. Con Javier dejo de coincidir: su tablero le
 * listaba lo pendiente y el boton le mandaba a un modulo que no tiene. Pudo
 * firmar, pero sin ver que firmaba.
 *
 * La dueña lo dijo asi: «Javier y Lissa tienen que tener acceso a los
 * documentos adjuntos para saber que es lo que firman [...] que la SP viaje
 * con la informacion completa y los documentos que se hayan adjuntado en su
 * proceso».
 *
 * Asi que el acto de firmar trae consigo las tres cosas, en el orden en que
 * se miran: el papel, su respaldo, y el boton. No hay que ir a buscar nada a
 * otra pantalla --y la pantalla donde estaba es de otra persona.
 */
export function FirmarModal({
  firma,
  pago,
  onClose,
}: {
  firma: Firma;
  /** La solicitud de pago, si la firma es de una. */
  pago: Pago | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const firmar = useFirmarDocumento();
  const [papel, setPapel] = useState(false);
  const hoja = useRef<HTMLDivElement | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  async function hacerlo() {
    setConfirmando(true);
    try {
      await firmar.mutateAsync(firma.id);
      toast.success('Firmado.');
      onClose();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title={`Firmar · ${firma.tipo ?? 'documento'}`} size="lg">
        <div className="space-y-4">
          <div className="rounded-md border border-sand bg-sand-l/40 p-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {pago?.serial && (
                <>
                  <dt className="text-dark-3">Solicitud</dt>
                  <dd className="font-extrabold text-dark">{pago.serial}</dd>
                </>
              )}
              {pago?.proveedor && (
                <>
                  <dt className="text-dark-3">A favor de</dt>
                  <dd className="text-dark">{pago.proveedor}</dd>
                </>
              )}
              {pago?.monto != null && (
                <>
                  <dt className="text-dark-3">Monto</dt>
                  <dd className="font-mono font-extrabold text-dark">
                    {pago.moneda} {Number(pago.monto).toLocaleString('es-GT', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </>
              )}
              {pago?.concepto && (
                <>
                  <dt className="text-dark-3">Concepto</dt>
                  <dd className="text-dark">{pago.concepto}</dd>
                </>
              )}
              {firma.recepcion && (
                <>
                  <dt className="text-dark-3">Recibida</dt>
                  <dd className="text-dark">{formatDate(firma.recepcion)}</dd>
                </>
              )}
              {firma.justificacion && (
                <>
                  <dt className="text-dark-3">Nota</dt>
                  <dd className="text-dark">{firma.justificacion}</dd>
                </>
              )}
            </dl>
          </div>

          {pago && (
            <>
              <button
                type="button"
                onClick={() => setPapel(true)}
                className="w-full rounded-md border border-teal/40 bg-teal-l/40 px-3 py-2 text-sm font-extrabold text-teal-d hover:bg-teal-l"
              >
                📄 Ver el formato oficial que vas a firmar
              </button>

              {/*
                El respaldo, aqui mismo. Incluye lo que trae de su origen --el
                control de vales, el registro de combustible-- sin que haya
                que saber de donde salio: la cadena la resuelve la politica de
                `documentos`.
              */}
              <div className="rounded-md border border-sand p-3">
                <ExpedienteDeLaSP pago={pago} canEdit={false} />
              </div>
            </>
          )}

          <div className="flex justify-between gap-2 border-t border-sand pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-sand px-4 py-2 text-sm text-dark-2 hover:bg-sand-l"
            >
              Ahora no
            </button>
            <button
              type="button"
              disabled={confirmando}
              onClick={() => void hacerlo()}
              className="rounded-md bg-gold px-5 py-2 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-60"
            >
              {confirmando ? 'Firmando…' : '✍️ Firmar'}
            </button>
          </div>
        </div>
      </Modal>

      {pago && (
        <PrintableModal
          open={papel}
          onClose={() => setPapel(false)}
          title={pago.serial ?? ''}
          acciones={<BotonSPConAdjuntos pago={pago} hoja={hoja} />}
        >
          <SolicitudPagoPrintable pago={pago} hojaRef={hoja} />
        </PrintableModal>
      )}
    </>
  );
}
