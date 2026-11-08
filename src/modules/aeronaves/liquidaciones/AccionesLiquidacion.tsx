import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { puede, useAuth } from '@/lib/auth';
import type { LiquidacionFila } from './api';
import {
  useEnviarAPagos, useEnviarARevision, useReabrir, useRevisores,
} from './hooks';

function q(n: number | null | undefined): string {
  return `Q ${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * El siguiente paso de una liquidación, donde se ve la liquidación.
 *
 * Vive en la tarjeta de la lista y no dentro de la hoja: mandar a Pagos rara
 * vez pasa en el mismo momento en que se cierra, y tener el botón adentro
 * obligaba a abrir el documento --entrar a editarlo-- solo para empujarlo.
 * «El botón de pagos debe de estar fuera, como lo tenemos en las demás
 * cosas.» Así que aquí está, y adentro ya no.
 */
export function AccionesLiquidacion({ liquidacion: l }: { liquidacion: LiquidacionFila }) {
  const { profile } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const enviarPagos = useEnviarAPagos(l.id);
  const reabrir = useReabrir(l.id);
  const [enviarRevision, setEnviarRevision] = useState(false);

  const canEdit = puede(profile, 'aeronaves', 'editor') || puede(profile, 'avn_liquidacion', 'editor');
  const esAdmin = profile?.rol === 'admin';
  const esPiloto = !puede(profile, 'aeronaves', 'editor') && puede(profile, 'avn_liquidacion', 'editor');

  // El piloto manda a revisar; quien opera manda a Pagos. La del piloto llega
  // a Pagos solo después de revisada.
  const aRevision = l.estado === 'Cerrada' && l.origen === 'piloto' && canEdit;
  const aPagosYa =
    canEdit && !esPiloto &&
    ((l.estado === 'Cerrada' && l.origen === 'operacion') || l.estado === 'Revisada');
  const sePuedeReabrir =
    l.estado !== 'Borrador' && esAdmin && !['Enviada a SP', 'Reembolsada'].includes(l.estado);

  if (!aRevision && !aPagosYa && !sePuedeReabrir) return null;

  async function aPagos() {
    const ok = await confirmar({
      title: 'Enviar a Pagos',
      message: (
        <>
          Se crea la solicitud de pago por el reembolso de <b>{q(l.piloto_gtq)}</b> al piloto de{' '}
          <b>{l.serial}</b>, y viaja con <b>todas las facturas</b> del viaje. Después de esto la
          liquidación ya no se toca.
        </>
      ),
      confirmLabel: 'Enviar a Pagos',
    });
    if (!ok) return;
    try {
      await enviarPagos.mutateAsync();
      toast.success('Enviada a Pagos con su expediente.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function reabrirla() {
    const ok = await confirmar({
      title: 'Reabrir liquidación',
      message: (
        <>
          <b>{l.serial}</b> vuelve a borrador y se le podrán cambiar los gastos. Queda registrado
          en la auditoría.
        </>
      ),
      confirmLabel: 'Reabrir',
    });
    if (!ok) return;
    try {
      await reabrir.mutateAsync();
      toast.success('Liquidación reabierta.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-t border-sand px-4 py-2.5">
        {aRevision && (
          <button type="button" onClick={() => setEnviarRevision(true)}
            className="rounded-md bg-rust px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-90">
            Enviar a…
          </button>
        )}

        {aPagosYa && (
          <button type="button" onClick={() => void aPagos()} disabled={enviarPagos.isPending}
            className="rounded-md bg-teal px-3 py-1.5 text-xs font-extrabold text-white hover:bg-teal-d disabled:opacity-50">
            {enviarPagos.isPending ? 'Enviando…' : 'Enviar a Pagos'}
          </button>
        )}

        {sePuedeReabrir && (
          <button type="button" onClick={() => void reabrirla()} disabled={reabrir.isPending}
            className="ml-auto rounded-md border border-rust px-3 py-1.5 text-xs font-semibold text-rust hover:bg-rust-l disabled:opacity-50">
            {reabrir.isPending ? 'Reabriendo…' : 'Reabrir'}
          </button>
        )}
      </div>

      {enviarRevision && (
        <EnviarARevision liquidacion={l} onClose={() => setEnviarRevision(false)} />
      )}
    </>
  );
}

/**
 * «Enviar a: Zonia o Mi». La lista sale de lo que la persona ES --quien opera
 * y no es piloto-- y no de una lista de nombres, para que el dia que exista el
 * usuario de Zonia aparezca solo.
 */
function EnviarARevision({
  liquidacion, onClose,
}: {
  liquidacion: LiquidacionFila;
  onClose: () => void;
}) {
  const toast = useToast();
  const revisores = useRevisores();
  const enviar = useEnviarARevision(liquidacion.id);
  const lista = revisores.data ?? [];
  const [destinatario, setDestinatario] = useState('');
  const [nota, setNota] = useState('');

  const elegido = destinatario || lista[0]?.id || '';

  return (
    <Modal open onClose={onClose} title="Enviar a revisión">
      <div className="space-y-3">
        <p className="text-xs text-dark-3">
          Va con <b>todo lo que cargaste</b>: los gastos y las fotos de las facturas. Quien la
          reciba puede aceptarla —y mandarla a Pagos— o devolvértela con una nota.
        </p>

        {lista.length === 0 ? (
          <p className="rounded-md border border-gold/40 bg-gold-light px-3 py-2 text-sm text-dark-2">
            No hay a quién mandarla todavía. Se necesita un usuario con rol{' '}
            <code>admin</code> o <code>asistente</code> que no sea piloto.
          </p>
        ) : (
          <Select label="Enviar a" value={elegido} onChange={(e) => setDestinatario(e.target.value)}>
            {lista.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre ?? r.id}</option>
            ))}
          </Select>
        )}

        <TextInput label="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)}
          placeholder="Lo del combustible de Flores lo pagué yo" />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="button" disabled={!elegido || enviar.isPending}
            onClick={async () => {
              try {
                await enviar.mutateAsync({
                  liquidacion, destinatarioId: elegido, nota: nota.trim() || null,
                });
                toast.success('Enviada a revisión.');
                onClose();
              } catch (err) {
                toast.error(describeError(err));
              }
            }}
            className="rounded-md bg-rust px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {enviar.isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
