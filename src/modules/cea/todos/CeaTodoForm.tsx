import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { CeaTodo, CeaTodoInsert } from './api';
import { CEA_TODO_ESTADOS, CEA_TODO_PRIORIDADES } from './api';

type FormState = {
  asunto: string;
  fecha: string;
  prioridad_label: string;
  estado_label: string;
  notas: string;
  done: boolean;
};

const empty: FormState = {
  asunto: '',
  fecha: '',
  prioridad_label: 'Media',
  estado_label: 'Comentado',
  notas: '',
  done: false,
};

function fromRow(r: CeaTodo | null | undefined): FormState {
  if (!r) return empty;
  return {
    asunto: r.asunto ?? '',
    fecha: r.fecha ?? '',
    prioridad_label: r.prioridad_label ?? 'Media',
    estado_label: r.estado_label ?? 'Comentado',
    notas: r.notas ?? '',
    done: r.done,
  };
}

function toInput(s: FormState): CeaTodoInsert {
  // Mantener prioridad/estado enums por compat con dashboards y RLS,
  // mapeo simple: Alta/Hold/TKIM → alta ; Media → media ; Baja → baja.
  const prioEnum =
    s.prioridad_label === 'Alta' || s.prioridad_label === 'Hold' || s.prioridad_label === 'TKIM'
      ? 'alta'
      : s.prioridad_label === 'Baja'
        ? 'baja'
        : 'media';
  const estadoEnum =
    s.estado_label === 'Ejecutado' || s.estado_label === 'Finalizado'
      ? 'completada'
      : s.estado_label === 'Descartado'
        ? 'cancelada'
        : s.estado_label === 'Planeado'
          ? 'en_progreso'
          : 'pendiente';
  return {
    asunto: s.asunto.trim(),
    fecha: s.fecha || null,
    prioridad: prioEnum,
    estado: estadoEnum,
    prioridad_label: s.prioridad_label,
    estado_label: s.estado_label,
    notas: s.notas.trim() || null,
    done: s.done,
  };
}

export function CeaTodoForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<CeaTodo, CeaTodoInsert>) {
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
    if (!v.asunto.trim()) {
      setError('El asunto es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput name="asunto" label="Asunto *" value={v.asunto} onChange={(e) => upd('asunto', e.target.value)} required autoFocus />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="fecha" label="Fecha" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} />
        <Select name="prioridad_label" label="Prioridad" value={v.prioridad_label} onChange={(e) => upd('prioridad_label', e.target.value)}>
          {CEA_TODO_PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select name="estado_label" label="Estado" value={v.estado_label} onChange={(e) => upd('estado_label', e.target.value)}>
          {CEA_TODO_ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-dark-2">
        <input type="checkbox" checked={v.done} onChange={(e) => upd('done', e.target.checked)} className="h-4 w-4 rounded border-sand text-teal focus:ring-teal" />
        Marcada como hecha
      </label>

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
