import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { AttViaje, AttViajeInsert } from './api';
import type { Database } from '@/types/database';

type TripStatus = Database['public']['Enums']['trip_status'];

type FormState = {
  titulo: string;
  fecha_ini: string;
  fecha_fin: string;
  pais: string;
  ciudad: string;
  acompanantes: string;
  proposito: string;
  other_reason: string;
  paidby: string;
  estado: TripStatus;
  lat: string;
  lng: string;
  notas: string;
};

const empty: FormState = {
  titulo: '',
  fecha_ini: '',
  fecha_fin: '',
  pais: '',
  ciudad: '',
  acompanantes: '',
  proposito: '',
  other_reason: '',
  paidby: '',
  estado: 'planificado',
  lat: '',
  lng: '',
  notas: '',
};

function fromRow(r: AttViaje | null | undefined): FormState {
  if (!r) return empty;
  return {
    titulo: r.titulo ?? '',
    fecha_ini: r.fecha_ini ?? '',
    fecha_fin: r.fecha_fin ?? '',
    pais: r.pais ?? '',
    ciudad: r.ciudad ?? '',
    acompanantes: r.acompanantes ?? '',
    proposito: r.proposito ?? '',
    other_reason: r.other_reason ?? '',
    paidby: r.paidby ?? '',
    estado: r.estado,
    lat: r.lat != null ? String(r.lat) : '',
    lng: r.lng != null ? String(r.lng) : '',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): AttViajeInsert {
  const t = (v: string) => v.trim() || null;
  const n = (v: string) => {
    const x = Number(v);
    return v.trim() === '' || !Number.isFinite(x) ? null : x;
  };
  return {
    titulo: s.titulo.trim(),
    destino: t([s.ciudad, s.pais].filter(Boolean).join(', ')),
    pais: t(s.pais),
    ciudad: t(s.ciudad),
    fecha_ini: s.fecha_ini || null,
    fecha_fin: s.fecha_fin || null,
    acompanantes: t(s.acompanantes),
    proposito: t(s.proposito),
    other_reason: t(s.other_reason),
    paidby: t(s.paidby),
    estado: s.estado,
    lat: n(s.lat),
    lng: n(s.lng),
    notas: t(s.notas),
  };
}

type Props = {
  initial?: AttViaje | null;
  submitting?: boolean;
  onSubmit: (values: AttViajeInsert) => void | Promise<void>;
  onCancel: () => void;
};

export function ViajeForm({ initial, submitting, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.titulo.trim()) {
      setError('El nombre del viaje es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput name="titulo" label="Nombre del viaje *" value={v.titulo} onChange={(e) => upd('titulo', e.target.value)} required autoFocus />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="pais" label="País" value={v.pais} onChange={(e) => upd('pais', e.target.value)} />
        <TextInput name="ciudad" label="Ciudad" value={v.ciudad} onChange={(e) => upd('ciudad', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="fecha_ini" label="Inicio" type="date" value={v.fecha_ini} onChange={(e) => upd('fecha_ini', e.target.value)} />
        <TextInput name="fecha_fin" label="Fin" type="date" value={v.fecha_fin} onChange={(e) => upd('fecha_fin', e.target.value)} />
      </div>
      <TextInput name="acompanantes" label="Participantes / pax" value={v.acompanantes} onChange={(e) => upd('acompanantes', e.target.value)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="proposito" label="Motivo" value={v.proposito} onChange={(e) => upd('proposito', e.target.value)} />
        <TextInput name="other_reason" label="Otro motivo" value={v.other_reason} onChange={(e) => upd('other_reason', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="paidby" label="Pagado por" value={v.paidby} onChange={(e) => upd('paidby', e.target.value)} />
        <Select name="estado" label="Estado" value={v.estado} onChange={(e) => upd('estado', e.target.value as TripStatus)}>
          <option value="planificado">Planificado</option>
          <option value="en_curso">En curso</option>
          <option value="completado">Completado</option>
          <option value="cancelado">Cancelado</option>
        </Select>
      </div>
      <fieldset className="rounded-md border border-sand p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Coordenadas (para el mapa)</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="lat" label="Latitud" type="number" step="0.000001" value={v.lat} onChange={(e) => upd('lat', e.target.value)} hint="ej. 14.6349 (Guatemala)" />
          <TextInput name="lng" label="Longitud" type="number" step="0.000001" value={v.lng} onChange={(e) => upd('lng', e.target.value)} hint="ej. -90.5069" />
        </div>
      </fieldset>
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear viaje'}
        </button>
      </div>
    </form>
  );
}
