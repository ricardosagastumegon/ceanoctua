import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { DocumentAttachment } from '@/components/ui/DocumentAttachment';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Evento, EventoInsert } from './api';
import type { Database } from '@/types/database';

type EventoTipo = Database['public']['Enums']['evento_tipo'];

type FormState = {
  titulo: string;
  fecha: string;
  tipo: EventoTipo | '';
  lugar: string;
  descripcion: string;
  notas: string;
};

const empty: FormState = { titulo: '', fecha: '', tipo: '', lugar: '', descripcion: '', notas: '' };

function fromRow(r: Evento | null | undefined): FormState {
  if (!r) return empty;
  return {
    titulo: r.titulo ?? '',
    fecha: r.fecha ? r.fecha.slice(0, 16) : '', // datetime-local format YYYY-MM-DDTHH:mm
    tipo: r.tipo ?? '',
    lugar: r.lugar ?? '',
    descripcion: r.descripcion ?? '',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): EventoInsert {
  return {
    titulo: s.titulo.trim(),
    fecha: s.fecha ? new Date(s.fecha).toISOString() : null,
    tipo: s.tipo === '' ? null : s.tipo,
    lugar: s.lugar.trim() || null,
    descripcion: s.descripcion.trim() || null,
    notas: s.notas.trim() || null,
  };
}

export function EventoForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Evento, EventoInsert>) {
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
      setError('El título es obligatorio.');
      return;
    }
    if (!v.fecha) {
      setError('La fecha es obligatoria.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput
        name="titulo"
        label="Título *"
        value={v.titulo}
        onChange={(e) => upd('titulo', e.target.value)}
        required
        autoFocus
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="fecha"
          label="Fecha y hora *"
          type="datetime-local"
          value={v.fecha}
          onChange={(e) => upd('fecha', e.target.value)}
          required
        />
        <Select name="tipo" label="Tipo" value={v.tipo} onChange={(e) => upd('tipo', e.target.value as EventoTipo | '')}>
          <option value="">—</option>
          <option value="reunion">Reunión</option>
          <option value="cumpleanos">Cumpleaños</option>
          <option value="aniversario">Aniversario</option>
          <option value="viaje">Viaje</option>
          <option value="religioso">Religioso</option>
          <option value="otro">Otro</option>
        </Select>
      </div>
      <TextInput name="lugar" label="Lugar" value={v.lugar} onChange={(e) => upd('lugar', e.target.value)} />
      <TextArea name="descripcion" label="Descripción" value={v.descripcion} onChange={(e) => upd('descripcion', e.target.value)} />
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {/* Document attachment only on existing events */}
      {initial?.id && (
        <div className="rounded-md border border-sand bg-sand-l/30 p-4">
          <DocumentAttachment entidadTipo="eventos" entidadId={initial.id} canEdit={true} label="Documento adjunto" />
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
          {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear evento'}
        </button>
      </div>
    </form>
  );
}
