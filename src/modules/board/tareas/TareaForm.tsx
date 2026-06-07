import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Tarea, TareaInsert } from './api';
import type { Database } from '@/types/database';

type Priority = Database['public']['Enums']['task_priority'];
type Status = Database['public']['Enums']['task_status'];

type FormState = {
  texto: string;
  lista: string;
  fecha: string;
  prioridad: Priority | '';
  estado: Status;
  notas: string;
  done: boolean;
};

const empty: FormState = {
  texto: '',
  lista: '',
  fecha: '',
  prioridad: '',
  estado: 'pendiente',
  notas: '',
  done: false,
};

function fromRow(r: Tarea | null | undefined): FormState {
  if (!r) return empty;
  return {
    texto: r.texto ?? '',
    lista: r.lista ?? '',
    fecha: r.fecha ?? '',
    prioridad: r.prioridad ?? '',
    estado: r.estado,
    notas: r.notas ?? '',
    done: r.done,
  };
}

function toInput(s: FormState): TareaInsert {
  return {
    texto: s.texto.trim(),
    lista: s.lista.trim() || null,
    fecha: s.fecha || null,
    prioridad: s.prioridad === '' ? null : s.prioridad,
    estado: s.estado,
    notas: s.notas.trim() || null,
    done: s.done,
  };
}

export function TareaForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Tarea, TareaInsert>) {
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
    if (!v.texto.trim()) {
      setError('El texto de la tarea es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput
        name="texto"
        label="Tarea *"
        value={v.texto}
        onChange={(e) => upd('texto', e.target.value)}
        required
        autoFocus
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <TextInput
            name="lista"
            label="Sub-lista"
            value={v.lista}
            onChange={(e) => upd('lista', e.target.value)}
            list="tareas-listas"
            hint="categoría (autocomplete + texto libre)"
          />
          <datalist id="tareas-listas">
            {/* Categorías derivadas del HTML original */}
            <option value="gifts">JA · Regalos & Detalles</option>
            <option value="home">LA · Casa</option>
            <option value="kids">LA · Hijas / Colegio</option>
            <option value="holding">LA · Empresa Holding</option>
            <option value="empresa">JM · Empresa</option>
            <option value="docs">AA · Documentos familia</option>
            <option value="seguridad">JA · Chofer / Seguridad</option>
            <option value="religioso">LA · Actividad Religiosa</option>
            <option value="fincas">EG · Viajes a fincas</option>
          </datalist>
        </div>
        <TextInput
          name="fecha"
          label="Fecha"
          type="date"
          value={v.fecha}
          onChange={(e) => upd('fecha', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          name="prioridad"
          label="Prioridad"
          value={v.prioridad}
          onChange={(e) => upd('prioridad', e.target.value as Priority | '')}
        >
          <option value="">—</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
        </Select>
        <Select
          name="estado"
          label="Estado"
          value={v.estado}
          onChange={(e) => upd('estado', e.target.value as Status)}
        >
          <option value="pendiente">Pendiente</option>
          <option value="en_progreso">En progreso</option>
          <option value="completada">Completada</option>
          <option value="cancelada">Cancelada</option>
        </Select>
      </div>
      <TextArea
        name="notas"
        label="Notas"
        value={v.notas}
        onChange={(e) => upd('notas', e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-dark-2">
        <input
          type="checkbox"
          checked={v.done}
          onChange={(e) => upd('done', e.target.checked)}
          className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
        />
        Marcada como hecha
      </label>

      {error && (
        <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
