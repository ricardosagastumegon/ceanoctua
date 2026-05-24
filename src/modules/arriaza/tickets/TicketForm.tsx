import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { AttTicket, AttTicketInsert } from './api';
import type { Database } from '@/types/database';
import { TicketPaxPanel } from './TicketPaxPanel';

type Currency = Database['public']['Enums']['currency'];

type FormState = {
  aerolinea: string;
  codigo_reserva: string;
  numero_ticket: string;
  numero_vuelo: string;
  tipo_vuelo: 'ida' | 'ida_vuelta';
  origen: string;
  destino: string;
  fecha_salida: string;
  fecha_llegada: string;
  asiento: string;
  clase: string;
  monto: string;
  moneda: Currency | '';
  comentarios: string;
};

const empty: FormState = {
  aerolinea: '',
  codigo_reserva: '',
  numero_ticket: '',
  numero_vuelo: '',
  tipo_vuelo: 'ida_vuelta',
  origen: '',
  destino: '',
  fecha_salida: '',
  fecha_llegada: '',
  asiento: '',
  clase: '',
  monto: '',
  moneda: '',
  comentarios: '',
};

function fromRow(r: AttTicket | null | undefined): FormState {
  if (!r) return empty;
  return {
    aerolinea: r.aerolinea ?? '',
    codigo_reserva: r.codigo_reserva ?? '',
    numero_ticket: r.numero_ticket ?? '',
    numero_vuelo: r.numero_vuelo ?? '',
    tipo_vuelo: (r.tipo_vuelo as 'ida' | 'ida_vuelta') ?? 'ida_vuelta',
    origen: r.origen ?? '',
    destino: r.destino ?? '',
    fecha_salida: r.fecha_salida ? r.fecha_salida.slice(0, 16) : '',
    fecha_llegada: r.fecha_llegada ? r.fecha_llegada.slice(0, 16) : '',
    asiento: r.asiento ?? '',
    clase: r.clase ?? '',
    monto: r.monto != null ? String(r.monto) : '',
    moneda: (r.moneda as Currency) ?? '',
    comentarios: r.comentarios ?? '',
  };
}

function toInput(s: FormState): AttTicketInsert {
  const t = (v: string) => v.trim() || null;
  const n = (v: string) => {
    const x = Number(v);
    return v.trim() === '' || !Number.isFinite(x) ? null : x;
  };
  return {
    viaje_id: '',
    aerolinea: t(s.aerolinea),
    codigo_reserva: t(s.codigo_reserva),
    numero_ticket: t(s.numero_ticket),
    numero_vuelo: t(s.numero_vuelo),
    tipo_vuelo: s.tipo_vuelo,
    origen: t(s.origen),
    destino: t(s.destino),
    fecha_salida: s.fecha_salida ? new Date(s.fecha_salida).toISOString() : null,
    fecha_llegada: s.fecha_llegada ? new Date(s.fecha_llegada).toISOString() : null,
    asiento: t(s.asiento),
    clase: t(s.clase),
    monto: n(s.monto),
    moneda: s.moneda === '' ? null : s.moneda,
    comentarios: t(s.comentarios),
  };
}

export function TicketForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<AttTicket, AttTicketInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  useEffect(() => {
    setV(fromRow(initial));
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="aerolinea" label="Aerolínea" value={v.aerolinea} onChange={(e) => upd('aerolinea', e.target.value)} autoFocus />
        <TextInput name="numero_vuelo" label="Núm. vuelo" value={v.numero_vuelo} onChange={(e) => upd('numero_vuelo', e.target.value)} />
        <Select name="tipo_vuelo" label="Tipo" value={v.tipo_vuelo} onChange={(e) => upd('tipo_vuelo', e.target.value as 'ida' | 'ida_vuelta')}>
          <option value="ida">Ida</option>
          <option value="ida_vuelta">Ida y vuelta</option>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="codigo_reserva" label="PNR / Código de reserva" value={v.codigo_reserva} onChange={(e) => upd('codigo_reserva', e.target.value)} />
        <TextInput name="numero_ticket" label="E-ticket" value={v.numero_ticket} onChange={(e) => upd('numero_ticket', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-md border border-sand p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">Salida</p>
          <TextInput name="origen" label="Aeropuerto" value={v.origen} onChange={(e) => upd('origen', e.target.value)} />
          <TextInput name="fecha_salida" label="Fecha y hora" type="datetime-local" value={v.fecha_salida} onChange={(e) => upd('fecha_salida', e.target.value)} />
        </div>
        <div className="space-y-2 rounded-md border border-sand p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">Llegada</p>
          <TextInput name="destino" label="Aeropuerto" value={v.destino} onChange={(e) => upd('destino', e.target.value)} />
          <TextInput name="fecha_llegada" label="Fecha y hora" type="datetime-local" value={v.fecha_llegada} onChange={(e) => upd('fecha_llegada', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <TextInput name="asiento" label="Asiento" value={v.asiento} onChange={(e) => upd('asiento', e.target.value)} />
        <TextInput name="clase" label="Cabina/clase" value={v.clase} onChange={(e) => upd('clase', e.target.value)} />
        <TextInput name="monto" label="Monto" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency | '')}>
          <option value="">—</option>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>
      <TextArea name="comentarios" label="Comentarios" value={v.comentarios} onChange={(e) => upd('comentarios', e.target.value)} />

      {initial?.id && <TicketPaxPanel ticketId={initial.id} canEdit />}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
