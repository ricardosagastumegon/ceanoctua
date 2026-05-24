import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Viaje, ViajeInsert } from './api';
import type { Database } from '@/types/database';
import { ViajeChecklist } from './ViajeChecklist';

type TripType = Database['public']['Enums']['trip_type'];
type TripStatus = Database['public']['Enums']['trip_status'];

type FormState = {
  destino: string;
  fecha_ini: string;
  fecha_fin: string;
  tipo: TripType | '';
  estado: TripStatus;
  notas: string;
};

const empty: FormState = { destino: '', fecha_ini: '', fecha_fin: '', tipo: '', estado: 'planificado', notas: '' };

function fromRow(r: Viaje | null | undefined): FormState {
  if (!r) return empty;
  return {
    destino: r.destino ?? '',
    fecha_ini: r.fecha_ini ?? '',
    fecha_fin: r.fecha_fin ?? '',
    tipo: r.tipo ?? '',
    estado: r.estado,
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): ViajeInsert {
  return {
    destino: s.destino.trim(),
    fecha_ini: s.fecha_ini || null,
    fecha_fin: s.fecha_fin || null,
    tipo: s.tipo === '' ? null : s.tipo,
    estado: s.estado,
    notas: s.notas.trim() || null,
  };
}

export function ViajeForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Viaje, ViajeInsert> & { canEdit?: boolean }) {
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
    if (!v.destino.trim()) {
      setError('El destino es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput
        name="destino"
        label="Destino *"
        value={v.destino}
        onChange={(e) => upd('destino', e.target.value)}
        required
        autoFocus
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="fecha_ini" label="Fecha de inicio" type="date" value={v.fecha_ini} onChange={(e) => upd('fecha_ini', e.target.value)} />
        <TextInput name="fecha_fin" label="Fecha de fin" type="date" value={v.fecha_fin} onChange={(e) => upd('fecha_fin', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="tipo" label="Tipo" value={v.tipo} onChange={(e) => upd('tipo', e.target.value as TripType | '')}>
          <option value="">—</option>
          <option value="personal">Personal</option>
          <option value="trabajo">Trabajo</option>
          <option value="familia">Familia</option>
          <option value="salud">Salud</option>
          <option value="otro">Otro</option>
        </Select>
        <Select name="estado" label="Estado" value={v.estado} onChange={(e) => upd('estado', e.target.value as TripStatus)}>
          <option value="planificado">Planificado</option>
          <option value="en_curso">En curso</option>
          <option value="completado">Completado</option>
          <option value="cancelado">Cancelado</option>
        </Select>
      </div>
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {/* Checklist only on existing viajes */}
      {initial?.id && (
        <div className="rounded-md border border-sand bg-sand-l/30 p-4">
          <ViajeChecklist viajeId={initial.id} canEdit={true} />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear viaje'}
        </button>
      </div>
    </form>
  );
}
