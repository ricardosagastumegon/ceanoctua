import { useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { fmtMoney } from '../utils';
import {
  useAttHotelHabitaciones,
  useCreateAttHotelHabitacion,
  useDeleteAttHotelHabitacion,
} from './habitaciones-hooks';
import { habitacionTotal } from './habitaciones-api';

// Panel de habitaciones múltiples · paridad con hotel.rooms[] del HTML.
// Se renderiza dentro de HotelForm cuando el hotel ya fue guardado (initial.id).
export function HabitacionesPanel({ hotelId, canEdit }: { hotelId: string; canEdit: boolean }) {
  const query = useAttHotelHabitaciones(hotelId);
  const create = useCreateAttHotelHabitacion();
  const remove = useDeleteAttHotelHabitacion();
  const toast = useToast();

  const [reservaNombre, setReservaNombre] = useState('');
  const [pax, setPax] = useState('');
  const [tipoHab, setTipoHab] = useState('');
  const [desayuno, setDesayuno] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [noches, setNoches] = useState('');

  const rows = query.data ?? [];
  const totalGeneral = rows.reduce((s, r) => s + habitacionTotal(r), 0);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!tipoHab.trim() && !reservaNombre.trim()) {
      toast.error('Al menos "Tipo" o "Reserva a nombre de" debe completarse.');
      return;
    }
    try {
      await create.mutateAsync({
        hotel_id: hotelId,
        reserva_nombre: reservaNombre.trim() || null,
        pax: pax ? Number(pax) : null,
        tipo_hab: tipoHab.trim() || null,
        desayuno: desayuno.trim() || null,
        tarifa: tarifa ? Number(tarifa) : null,
        noches: noches ? Number(noches) : null,
      });
      setReservaNombre(''); setPax(''); setTipoHab(''); setDesayuno(''); setTarifa(''); setNoches('');
    } catch (err) { toast.error(describeError(err)); }
  }

  async function del(id: string) {
    try { await remove.mutateAsync({ id, hotelId }); } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  return (
    <div className="rounded-md border border-gold/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider text-gold">
          🛏️ Habitaciones <span className="ml-1 rounded-full bg-gold-light px-1.5 text-[10px] text-gold">{rows.length}</span>
        </div>
        {rows.length > 0 && (
          <div className="text-xs font-extrabold text-gold">Total: {fmtMoney(totalGeneral)}</div>
        )}
      </div>

      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {!query.isLoading && rows.length === 0 && (
        <div className="mb-2 text-xs italic text-dark-3">Sin habitaciones. Agrega la primera abajo.</div>
      )}

      {rows.map((r) => (
        <div key={r.id} className="mb-1 flex items-center gap-2 rounded-md bg-gold-light/40 px-2 py-1.5 text-xs">
          <div className="flex-1">
            <div className="font-extrabold text-dark-2">
              {r.tipo_hab ?? 'Habitación'}{r.reserva_nombre ? ` · ${r.reserva_nombre}` : ''}
            </div>
            <div className="text-[10px] text-dark-3">
              {r.pax ?? 0} pax · {r.desayuno || '—'} · Tarifa {fmtMoney(r.tarifa)} × {r.noches ?? 0}n
            </div>
          </div>
          <div className="font-extrabold text-gold">{fmtMoney(habitacionTotal(r))}</div>
          {canEdit && (
            <button
              type="button"
              onClick={() => void del(r.id)}
              className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust"
              title="Eliminar"
            >🗑</button>
          )}
        </div>
      ))}

      {canEdit && (
        <form onSubmit={add} className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-white p-2">
          <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} />
          <TextInput label="Pax" type="number" min="1" value={pax} onChange={(e) => setPax(e.target.value)} />
          <TextInput label="Tipo de habitación" value={tipoHab} onChange={(e) => setTipoHab(e.target.value)} placeholder="Suite, Doble…" />
          <TextInput label="Desayuno" value={desayuno} onChange={(e) => setDesayuno(e.target.value)} placeholder="Incluido / No" />
          <TextInput label="Tarifa/noche (US$)" type="number" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
          <TextInput label="Noches" type="number" min="0" value={noches} onChange={(e) => setNoches(e.target.value)} />
          <button
            type="submit"
            disabled={create.isPending}
            className="col-span-2 rounded-md bg-gold px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50"
          >
            {create.isPending ? 'Agregando…' : '+ Agregar habitación'}
          </button>
        </form>
      )}
    </div>
  );
}
