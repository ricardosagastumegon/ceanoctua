import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { AttRestaurante, AttRestauranteInsert } from './api';
import type { Database } from '@/types/database';
import { RestaurantDinersPanel } from './RestaurantDinersPanel';
import { RestaurantServicesPanel } from './RestaurantServicesPanel';
import { PayRecordsPanel } from '@/modules/arriaza/shared/PayRecordsPanel';

type Currency = Database['public']['Enums']['currency'];

type FormState = {
  nombre: string;
  specialty: string;
  phone: string;
  email: string;
  location: string;
  fecha: string;
  hora: string;
  covers: string;
  conf: string;
  monto: string;
  moneda: Currency | '';
  stars: string;
  detalles: string;
  cancel_policy: string;
};

const empty: FormState = {
  nombre: '',
  specialty: '',
  phone: '',
  email: '',
  location: '',
  fecha: '',
  hora: '',
  covers: '',
  conf: '',
  monto: '',
  moneda: '',
  stars: '',
  detalles: '',
  cancel_policy: '',
};

function fromRow(r: AttRestaurante | null | undefined): FormState {
  if (!r) return empty;
  return {
    nombre: r.nombre ?? '',
    specialty: r.specialty ?? '',
    phone: r.phone ?? '',
    email: r.email ?? '',
    location: r.location ?? '',
    fecha: r.fecha ?? '',
    hora: r.hora ? r.hora.slice(0, 5) : '',
    covers: r.covers != null ? String(r.covers) : '',
    conf: r.conf ?? '',
    monto: r.monto != null ? String(r.monto) : '',
    moneda: (r.moneda as Currency) ?? '',
    stars: r.stars != null ? String(r.stars) : '',
    detalles: r.detalles ?? '',
    cancel_policy: r.cancel_policy ?? '',
  };
}

function toInput(s: FormState): AttRestauranteInsert {
  const t = (v: string) => v.trim() || null;
  const n = (v: string) => {
    const x = Number(v);
    return v.trim() === '' || !Number.isFinite(x) ? null : x;
  };
  return {
    viaje_id: '',
    nombre: s.nombre.trim() || 'Restaurante',
    specialty: t(s.specialty),
    phone: t(s.phone),
    email: t(s.email),
    location: t(s.location),
    fecha: s.fecha || null,
    hora: s.hora || null,
    covers: n(s.covers),
    conf: t(s.conf),
    monto: n(s.monto),
    moneda: s.moneda === '' ? null : s.moneda,
    stars: n(s.stars),
    detalles: t(s.detalles),
    cancel_policy: t(s.cancel_policy),
  };
}

export function RestauranteForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<AttRestaurante, AttRestauranteInsert>) {
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="nombre" label="Restaurante" value={v.nombre} onChange={(e) => upd('nombre', e.target.value)} autoFocus required />
        <TextInput name="specialty" label="Especialidad" value={v.specialty} onChange={(e) => upd('specialty', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="phone" label="Teléfono" value={v.phone} onChange={(e) => upd('phone', e.target.value)} />
        <TextInput name="email" label="Email" type="email" value={v.email} onChange={(e) => upd('email', e.target.value)} />
      </div>
      <TextInput name="location" label="Ubicación" value={v.location} onChange={(e) => upd('location', e.target.value)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <TextInput name="fecha" label="Fecha" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} />
        <TextInput name="hora" label="Hora" type="time" value={v.hora} onChange={(e) => upd('hora', e.target.value)} />
        <TextInput name="covers" label="Pax" type="number" min="0" step="1" value={v.covers} onChange={(e) => upd('covers', e.target.value)} />
        <TextInput name="conf" label="Conf." value={v.conf} onChange={(e) => upd('conf', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="monto" label="Total" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency | '')}>
          <option value="">—</option>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
        <TextInput name="stars" label="Estrellas Michelin" type="number" min="0" max="3" step="1" value={v.stars} onChange={(e) => upd('stars', e.target.value)} />
      </div>
      <TextArea name="detalles" label="Detalles" value={v.detalles} onChange={(e) => upd('detalles', e.target.value)} />
      <TextArea name="cancel_policy" label="Política de cancelación" value={v.cancel_policy} onChange={(e) => upd('cancel_policy', e.target.value)} />

      {initial?.id && (
        <>
          <RestaurantDinersPanel restauranteId={initial.id} canEdit />
          <RestaurantServicesPanel
            restauranteId={initial.id}
            moneda={v.moneda || initial.moneda || 'GTQ'}
            canEdit
          />
          <PayRecordsPanel
            tableName="att_restaurant_pay_records"
            parentColumn="restaurante_id"
            parentId={initial.id}
            moneda={v.moneda || initial.moneda || 'GTQ'}
            canEdit
          />
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
