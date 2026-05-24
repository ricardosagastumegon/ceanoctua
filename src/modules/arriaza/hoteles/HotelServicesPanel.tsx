import { useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { formatMoney } from '@/lib/money';
import {
  useCreateHotelService,
  useDeleteHotelService,
  useHotelServices,
} from './services-api';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

type Props = { hotelId: string; moneda: string; canEdit: boolean };

export function HotelServicesPanel({ hotelId, moneda, canEdit }: Props) {
  const query = useHotelServices(hotelId);
  const create = useCreateHotelService(hotelId);
  const remove = useDeleteHotelService(hotelId);
  const toast = useToast();

  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [notas, setNotas] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre del servicio es obligatorio.');
      return;
    }
    const m = Number(monto);
    try {
      await create.mutateAsync({
        nombre: nombre.trim(),
        monto: Number.isFinite(m) ? m : 0,
        notas: notas.trim() || null,
      });
      setNombre('');
      setMonto('');
      setNotas('');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  async function del(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch (e) {
      toast.error(describeError(e, 'delete'));
    }
  }

  const items = query.data ?? [];
  const total = items.reduce((s, x) => s + Number(x.monto ?? 0), 0);

  return (
    <fieldset className="rounded-md border border-sand bg-sand-l/30 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
        Servicios adicionales
      </legend>
      {canEdit && (
        <form onSubmit={add} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
          <TextInput
            name="hs_nombre"
            label="Servicio"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Transfer, desayuno, spa…"
          />
          <TextInput
            name="hs_monto"
            label="Monto"
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <TextInput
            name="hs_notas"
            label="Notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="self-end rounded-md bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-60"
          >
            ＋ Agregar
          </button>
        </form>
      )}

      {query.isLoading ? (
        <p className="text-xs text-dark-3">Cargando servicios…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-dark-3">Sin servicios adicionales registrados.</p>
      ) : (
        <ul className="divide-y divide-sand">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex-1">
                <span className="font-medium text-dark">{s.nombre}</span>
                {s.notas && <span className="ml-2 text-xs text-dark-3">{s.notas}</span>}
              </div>
              <span className="font-mono text-dark">{fmt(Number(s.monto ?? 0), moneda)}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void del(s.id)}
                  className="rounded-md border border-rust/40 px-2 py-0.5 text-xs text-rust hover:bg-rust-l"
                  title="Eliminar"
                >
                  ×
                </button>
              )}
            </li>
          ))}
          <li className="flex items-center justify-between border-t-2 border-dark/20 py-2 pt-3 text-sm font-semibold">
            <span className="text-dark-2">Total servicios ({items.length})</span>
            <span className="font-mono text-teal-d">{fmt(total, moneda)}</span>
          </li>
        </ul>
      )}
    </fieldset>
  );
}
