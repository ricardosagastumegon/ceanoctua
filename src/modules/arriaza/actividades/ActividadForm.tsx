import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { SERVICE_META, type EstadoPago } from '../constants/serviceMeta';
import { PaymentFields } from '../shared/PaymentFields';
import { fmtMoney } from '../utils';
import { actividadTicketTotal, actividadTotal } from './api';
import type { AttActividad, AttActividadInsert, AttActividadTicket } from './api';

// Draft de tickets de actividad (in-memory hasta guardar la actividad y sus hijos).
type TicketDraft = {
  id?: string;
  nombres: string;
  personas: string;
  confirmacion: string;
  lugares: string;
  tarifa: string;
  monto_extras: string;
  extras: string;
  tiene_subtickets: boolean;
  subtickets: { id?: string; nombre: string; ticket: string; lugar: string }[];
};

const emptyTicket = (): TicketDraft => ({
  nombres: '', personas: '', confirmacion: '', lugares: '',
  tarifa: '', monto_extras: '', extras: '', tiene_subtickets: false, subtickets: [],
});

export function ActividadForm({ open, viajeId, editing, existingTickets, submitting, onClose, onSubmit }: {
  open: boolean; viajeId: string; editing: AttActividad | null;
  existingTickets: AttActividadTicket[];
  submitting: boolean; onClose: () => void;
  onSubmit: (values: AttActividadInsert, tickets: TicketDraft[]) => void | Promise<void>;
}) {
  const [evento, setEvento] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [duracion, setDuracion] = useState('');
  const [fecha, setFecha] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [reservado, setReservado] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [tickets, setTickets] = useState<TicketDraft[]>([emptyTicket()]);
  const [estatusPago, setEstatusPago] = useState('');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('Reservado');
  const [pagadoCon, setPagadoCon] = useState('');
  const [confirmFile, setConfirmFile] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEvento(editing.evento ?? ''); setCiudad(editing.ciudad ?? '');
      setDireccion(editing.direccion ?? ''); setDescripcion(editing.descripcion ?? '');
      setDuracion(editing.duracion ?? '');
      setFecha(editing.fecha ?? ''); setInicio(editing.inicio ?? ''); setFin(editing.fin ?? '');
      setReservado(editing.reservado ?? ''); setCancelacion(editing.cancelacion ?? '');
      setComentarios(editing.comentarios ?? '');
      setEstatusPago(editing.estatus_pago ?? ''); setEstadoPago(editing.estado_pago ?? 'Reservado');
      setPagadoCon(editing.pagado_con ?? ''); setConfirmFile(editing.confirm_file_name ?? '');
      setTickets(
        existingTickets.length
          ? existingTickets.map((t) => ({
              id: t.id,
              nombres: t.nombres ?? '',
              personas: t.personas != null ? String(t.personas) : '',
              confirmacion: t.confirmacion ?? '',
              lugares: t.lugares ?? '',
              tarifa: t.tarifa != null ? String(t.tarifa) : '',
              monto_extras: t.monto_extras != null ? String(t.monto_extras) : '',
              extras: t.extras ?? '',
              tiene_subtickets: t.tiene_subtickets,
              subtickets: [],
            }))
          : [emptyTicket()],
      );
    } else {
      setEvento(''); setCiudad(''); setDireccion(''); setDescripcion(''); setDuracion('');
      setFecha(''); setInicio(''); setFin(''); setReservado(''); setCancelacion(''); setComentarios('');
      setEstatusPago(''); setEstadoPago('Reservado'); setPagadoCon(''); setConfirmFile('');
      setTickets([emptyTicket()]);
    }
    setError(null);
  }, [open, editing, existingTickets]);

  const totalPreview = useMemo(() => {
    return actividadTotal(
      tickets.map((t) => ({
        tarifa: Number(t.tarifa || 0),
        personas: Number(t.personas || 0),
        monto_extras: Number(t.monto_extras || 0),
      })) as AttActividadTicket[],
    );
  }, [tickets]);

  function addTicket() { setTickets((ts) => [...ts, emptyTicket()]); }
  function removeTicket(i: number) { setTickets((ts) => ts.filter((_, idx) => idx !== i)); }
  function updTicket(i: number, patch: Partial<TicketDraft>) {
    setTickets((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function addSub(i: number) {
    updTicket(i, { subtickets: [...tickets[i].subtickets, { nombre: '', ticket: '', lugar: '' }] });
  }
  function removeSub(i: number, j: number) {
    updTicket(i, { subtickets: tickets[i].subtickets.filter((_, idx) => idx !== j) });
  }
  function updSub(i: number, j: number, field: 'nombre' | 'ticket' | 'lugar', val: string) {
    updTicket(i, {
      subtickets: tickets[i].subtickets.map((s, idx) => (idx === j ? { ...s, [field]: val } : s)),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!evento.trim()) return setError('El evento es obligatorio.');
    setError(null);
    void onSubmit(
      {
        viaje_id: viajeId,
        evento: evento.trim(),
        ciudad: ciudad.trim() || null,
        direccion: direccion.trim() || null,
        descripcion: descripcion.trim() || null,
        duracion: duracion.trim() || null,
        fecha: fecha || null,
        inicio: inicio || null,
        fin: fin || null,
        reservado: reservado.trim() || null,
        cancelacion: cancelacion.trim() || null,
        comentarios: comentarios.trim() || null,
        estatus_pago: estatusPago.trim() || null,
        estado_pago: estadoPago,
        pagado_con: pagadoCon || null,
        confirm_file_name: confirmFile.trim() || null,
      },
      tickets,
    );
  }

  const meta = SERVICE_META.actividades;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nueva'} Actividad`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Evento *" value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Concierto en Hollywood Bowl" autoFocus />
          <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </div>
        <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <TextInput label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <div className="grid grid-cols-4 gap-3">
          <TextInput label="Duración" value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="3 horas" />
          <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <TextInput label="Inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <TextInput label="Fin" type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
        <TextInput label="Reservado a través de" value={reservado} onChange={(e) => setReservado(e.target.value)} />

        <div className="rounded-lg border border-sand p-3">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
            Tickets de Actividad
          </div>
          {tickets.map((t, i) => (
            <div key={i} className="mb-3 rounded-md border border-sand-d bg-sand-l p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple">Ticket {i + 1}</div>
                {tickets.length > 1 && (
                  <button type="button" onClick={() => removeTicket(i)} className="text-[11px] text-rust hover:underline">Quitar ticket</button>
                )}
              </div>
              <TextInput label="Reserva a nombre de (uno o varios)" value={t.nombres} onChange={(e) => updTicket(i, { nombres: e.target.value })} placeholder="Nombres separados por coma" />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <TextInput label="Personas" type="number" min="1" value={t.personas} onChange={(e) => updTicket(i, { personas: e.target.value })} />
                <TextInput label="Confirmación" value={t.confirmacion} onChange={(e) => updTicket(i, { confirmacion: e.target.value })} />
                <TextInput label="Lugares" value={t.lugares} onChange={(e) => updTicket(i, { lugares: e.target.value })} placeholder="Fila 5, VIP" />
              </div>
              <div className="mt-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-dark-2">
                  <input type="checkbox" checked={t.tiene_subtickets} onChange={(e) => updTicket(i, { tiene_subtickets: e.target.checked, subtickets: e.target.checked && !t.subtickets.length ? [{ nombre: '', ticket: '', lugar: '' }] : t.subtickets })} />
                  ¿Aplica No. de Ticket individual?
                </label>
              </div>
              {t.tiene_subtickets && (
                <div className="mt-2 rounded-md border border-purple/25 bg-white p-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple">Tickets individuales</div>
                  {t.subtickets.map((s, j) => (
                    <div key={j} className="mt-1 grid grid-cols-[1fr_1fr_1fr_32px] gap-2">
                      <TextInput value={s.nombre} onChange={(e) => updSub(i, j, 'nombre', e.target.value)} placeholder="Nombre" />
                      <TextInput value={s.ticket} onChange={(e) => updSub(i, j, 'ticket', e.target.value)} placeholder="No. Ticket" />
                      <TextInput value={s.lugar} onChange={(e) => updSub(i, j, 'lugar', e.target.value)} placeholder="Lugar" />
                      <button type="button" onClick={() => removeSub(i, j)} className="rounded-md border border-sand px-2 text-xs hover:border-rust">🗑</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addSub(i)} className="mt-1 text-[11px] font-semibold text-teal-d hover:underline">+ Ticket individual</button>
                </div>
              )}
              <div className="mt-2 grid grid-cols-3 gap-2">
                <TextInput label="Tarifa/persona" type="number" step="0.01" value={t.tarifa} onChange={(e) => updTicket(i, { tarifa: e.target.value })} />
                <TextInput label="Monto extras" type="number" step="0.01" value={t.monto_extras} onChange={(e) => updTicket(i, { monto_extras: e.target.value })} />
                <TextInput label="Extras (descripción)" value={t.extras} onChange={(e) => updTicket(i, { extras: e.target.value })} />
              </div>
              <div className="mt-2 text-right text-[11px] font-extrabold text-purple">
                Total ticket: {fmtMoney(actividadTicketTotal({ tarifa: Number(t.tarifa || 0), personas: Number(t.personas || 0), monto_extras: Number(t.monto_extras || 0) } as AttActividadTicket))}
              </div>
            </div>
          ))}
          <button type="button" onClick={addTicket} className="text-xs font-semibold text-teal-d hover:underline">+ Agregar Ticket de Actividad</button>
        </div>

        <div style={{ background: meta.grad }} className="flex items-center justify-between rounded-lg px-4 py-3 text-white">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">🎭 Gran Total</div>
            <div className="text-[10px] text-white/50">Suma de todos los tickets</div>
          </div>
          <div className="font-heading text-xl font-extrabold">{fmtMoney(totalPreview)}</div>
        </div>

        <TextInput label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} />
        <TextArea label="Comentarios" value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} />

        <PaymentFields estatusPago={estatusPago} onEstatusPago={setEstatusPago} estadoPago={estadoPago} onEstadoPago={setEstadoPago} pagadoCon={pagadoCon} onPagadoCon={setPagadoCon} confirmFileName={confirmFile} onConfirmFileName={setConfirmFile} />

        {error && <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
          <button type="submit" disabled={submitting} style={{ backgroundColor: meta.solid }} className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? 'Guardando…' : '💾 Guardar Actividad'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
