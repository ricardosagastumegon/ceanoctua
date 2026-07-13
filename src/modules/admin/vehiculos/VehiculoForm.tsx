import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Vehiculo, VehiculoInsert } from './api';

// Fase 18 · Form del catálogo Vehículos.
// Ancla: src/modules/admin/components/EmpleadoForm.tsx (patrón simple
// de catálogo sin dependencias externas).
//
// Reglas del prompt:
//   * 6 campos en orden marca · color · placa · tipo · uso · alias
//   * Solo marca y placa son obligatorios
//   * Sin validación de formato de placa (PENDIENTE — el usuario lo
//     confirmará más adelante)

type FormState = {
  marca: string;
  color: string;
  placa: string;
  tipo: string;
  uso: string;
  alias: string;
};

const empty: FormState = {
  marca: '',
  color: '',
  placa: '',
  tipo: '',
  uso: '',
  alias: '',
};

function fromRow(r: Vehiculo | null | undefined): FormState {
  if (!r) return empty;
  return {
    marca: r.marca ?? '',
    color: r.color ?? '',
    placa: r.placa ?? '',
    tipo: r.tipo ?? '',
    uso: r.uso ?? '',
    alias: r.alias ?? '',
  };
}

function toInput(s: FormState): VehiculoInsert {
  return {
    marca: s.marca.trim(),
    color: s.color.trim() || null,
    placa: s.placa.trim(),
    tipo: s.tipo.trim() || null,
    uso: s.uso.trim() || null,
    alias: s.alias.trim() || null,
  };
}

export function VehiculoForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Vehiculo, VehiculoInsert>) {
  const [values, setValues] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, v: string) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.marca.trim()) {
      setError('Marca es obligatoria.');
      return;
    }
    if (!values.placa.trim()) {
      setError('Placa es obligatoria.');
      return;
    }
    setError(null);
    await onSubmit(toInput(values));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="marca"
          label="Marca *"
          value={values.marca}
          onChange={(e) => upd('marca', e.target.value)}
          required
          autoFocus
        />
        <TextInput
          name="color"
          label="Color"
          value={values.color}
          onChange={(e) => upd('color', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="placa"
          label="Placa *"
          value={values.placa}
          onChange={(e) => upd('placa', e.target.value)}
          required
          hint="única entre vehículos activos"
        />
        <TextInput
          name="tipo"
          label="Tipo"
          value={values.tipo}
          onChange={(e) => upd('tipo', e.target.value)}
          hint="ej. sedán, camioneta, moto…"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="uso"
          label="Uso"
          value={values.uso}
          onChange={(e) => upd('uso', e.target.value)}
          hint="ej. gerencia, mensajería, campo…"
        />
        <TextInput
          name="alias"
          label="Alias"
          value={values.alias}
          onChange={(e) => upd('alias', e.target.value)}
          hint="nombre coloquial del vehículo"
        />
      </div>

      {error && (
        <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
