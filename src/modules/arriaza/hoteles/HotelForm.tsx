import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { AttHotel, AttHotelInsert } from './api';
import type { Database } from '@/types/database';
import { HotelServicesPanel } from './HotelServicesPanel';
import { HabitacionesPanel } from './HabitacionesPanel';
import { PayRecordsPanel } from '@/modules/arriaza/shared/PayRecordsPanel';

type Currency = Database['public']['Enums']['currency'];

type FormState = {
  nombre: string;
  location: string;
  checkin: string;
  checkout: string;
  nights: string;
  confirmacion: string;
  room: string;
  rate: string;
  monto: string;
  moneda: Currency | '';
  ota: string;
  pay: string;
  services: string;
  cancel_policy: string;
  notas: string;
};

const empty: FormState = {
  nombre: '',
  location: '',
  checkin: '',
  checkout: '',
  nights: '',
  confirmacion: '',
  room: '',
  rate: '',
  monto: '',
  moneda: '',
  ota: '',
  pay: '',
  services: '',
  cancel_policy: '',
  notas: '',
};

function fromRow(r: AttHotel | null | undefined): FormState {
  if (!r) return empty;
  return {
    nombre: r.nombre ?? '',
    location: r.location ?? '',
    checkin: r.checkin ?? '',
    checkout: r.checkout ?? '',
    nights: r.nights != null ? String(r.nights) : '',
    confirmacion: r.confirmacion ?? '',
    room: r.room ?? '',
    rate: r.rate != null ? String(r.rate) : '',
    monto: r.monto != null ? String(r.monto) : '',
    moneda: (r.moneda as Currency) ?? '',
    ota: r.ota ?? '',
    pay: r.pay ?? '',
    services: r.services ?? '',
    cancel_policy: r.cancel_policy ?? '',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): AttHotelInsert {
  const t = (v: string) => v.trim() || null;
  const n = (v: string) => {
    const x = Number(v);
    return v.trim() === '' || !Number.isFinite(x) ? null : x;
  };
  return {
    viaje_id: '',
    nombre: s.nombre.trim() || 'Hotel sin nombre',
    location: t(s.location),
    checkin: s.checkin || null,
    checkout: s.checkout || null,
    nights: n(s.nights),
    confirmacion: t(s.confirmacion),
    room: t(s.room),
    rate: n(s.rate),
    monto: n(s.monto),
    moneda: s.moneda === '' ? null : s.moneda,
    ota: t(s.ota),
    pay: t(s.pay),
    services: t(s.services),
    cancel_policy: t(s.cancel_policy),
    notas: t(s.notas),
  };
}

export function HotelForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<AttHotel, AttHotelInsert>) {
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
        <TextInput name="nombre" label="Hotel" value={v.nombre} onChange={(e) => upd('nombre', e.target.value)} autoFocus required />
        <TextInput name="location" label="Ubicación" value={v.location} onChange={(e) => upd('location', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="checkin" label="Check-in" type="date" value={v.checkin} onChange={(e) => upd('checkin', e.target.value)} />
        <TextInput name="checkout" label="Check-out" type="date" value={v.checkout} onChange={(e) => upd('checkout', e.target.value)} />
        <TextInput name="nights" label="Noches" type="number" min="0" step="1" value={v.nights} onChange={(e) => upd('nights', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="confirmacion" label="Confirmación" value={v.confirmacion} onChange={(e) => upd('confirmacion', e.target.value)} />
        <TextInput name="room" label="Habitación" value={v.room} onChange={(e) => upd('room', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="rate" label="Tarifa noche" type="number" min="0" step="0.01" value={v.rate} onChange={(e) => upd('rate', e.target.value)} />
        <TextInput name="monto" label="Total" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency | '')}>
          <option value="">—</option>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="ota" label="OTA / agencia" value={v.ota} onChange={(e) => upd('ota', e.target.value)} />
        <TextInput name="pay" label="Forma de pago" value={v.pay} onChange={(e) => upd('pay', e.target.value)} />
      </div>
      <TextArea name="services" label="Servicios (notas libres)" value={v.services} onChange={(e) => upd('services', e.target.value)} hint="Para servicios con monto, usa la tabla de abajo (solo después de guardar el hotel)." />
      <TextArea name="cancel_policy" label="Política de cancelación" value={v.cancel_policy} onChange={(e) => upd('cancel_policy', e.target.value)} />
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {initial?.id && (
        <>
          {/* F19-1 · habitaciones múltiples por hotel (paridad hotel.rooms[] del HTML) */}
          <HabitacionesPanel hotelId={initial.id} canEdit />
          <HotelServicesPanel
            hotelId={initial.id}
            moneda={v.moneda || initial.moneda || 'GTQ'}
            canEdit
          />
          <PayRecordsPanel
            tableName="att_hotel_pay_records"
            parentColumn="hotel_id"
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
