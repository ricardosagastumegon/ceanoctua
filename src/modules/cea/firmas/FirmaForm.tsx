import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { DocumentAttachment } from '@/components/ui/DocumentAttachment';
import type { Database } from '@/types/database';
import type { FirmaInsert, FirmaWithSigners } from './api';
import { useBoardMiembros } from './hooks';

type Urgencia = Database['public']['Enums']['firma_urgencia'];
type StatusFirma = Database['public']['Enums']['firma_status'];

type FormState = {
  recepcion: string;
  tipo: string;
  urgencia: Urgencia | '';
  justificacion: string;
  entregado: string;
  solicitado: string;
  status_firma: StatusFirma;
  fecha_firma: string;
  fecha_entrega: string;
  quien_recibe: string;
};

const empty: FormState = {
  recepcion: '',
  tipo: '',
  urgencia: '',
  justificacion: '',
  entregado: '',
  solicitado: '',
  status_firma: 'en_espera',
  fecha_firma: '',
  fecha_entrega: '',
  quien_recibe: '',
};

function fromRow(r: FirmaWithSigners | null | undefined): { fields: FormState; miembroIds: string[] } {
  if (!r) return { fields: empty, miembroIds: [] };
  return {
    fields: {
      recepcion: r.recepcion ?? '',
      tipo: r.tipo ?? '',
      urgencia: r.urgencia ?? '',
      justificacion: r.justificacion ?? '',
      entregado: r.entregado ?? '',
      solicitado: r.solicitado ?? '',
      status_firma: r.status_firma,
      fecha_firma: r.fecha_firma ?? '',
      fecha_entrega: r.fecha_entrega ?? '',
      quien_recibe: r.quien_recibe ?? '',
    },
    miembroIds: r.miembro_ids,
  };
}

function toInput(s: FormState): FirmaInsert {
  return {
    recepcion: s.recepcion || null,
    tipo: s.tipo.trim(),
    urgencia: s.urgencia === '' ? null : s.urgencia,
    justificacion: s.justificacion.trim() || null,
    entregado: s.entregado.trim() || null,
    solicitado: s.solicitado.trim() || null,
    status_firma: s.status_firma,
    fecha_firma: s.fecha_firma || null,
    fecha_entrega: s.fecha_entrega || null,
    quien_recibe: s.quien_recibe.trim() || null,
  };
}

type FirmaFormProps = {
  initial?: FirmaWithSigners | null;
  submitting?: boolean;
  onSubmit: (values: FirmaInsert, miembroIds: string[]) => void | Promise<void>;
  onCancel: () => void;
};

export function FirmaForm({ initial, submitting, onSubmit, onCancel }: FirmaFormProps) {
  const initialState = fromRow(initial);
  const [v, setV] = useState<FormState>(initialState.fields);
  const [miembroIds, setMiembroIds] = useState<string[]>(initialState.miembroIds);
  const [error, setError] = useState<string | null>(null);
  const miembrosQuery = useBoardMiembros();

  useEffect(() => {
    const s = fromRow(initial);
    setV(s.fields);
    setMiembroIds(s.miembroIds);
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  function toggleMiembro(id: string) {
    setMiembroIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.tipo.trim()) {
      setError('El tipo de documento es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v), miembroIds);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="recepcion" label="Fecha recepción" type="date" value={v.recepcion} onChange={(e) => upd('recepcion', e.target.value)} />
        <TextInput name="tipo" label="Tipo de documento *" value={v.tipo} onChange={(e) => upd('tipo', e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="urgencia" label="Urgencia" value={v.urgencia} onChange={(e) => upd('urgencia', e.target.value as Urgencia | '')}>
          <option value="">—</option>
          <option value="urgente">Urgente</option>
          <option value="importante">Importante</option>
          <option value="programado">Programado</option>
        </Select>
        <Select name="status_firma" label="Estado de la firma" value={v.status_firma} onChange={(e) => upd('status_firma', e.target.value as StatusFirma)}>
          <option value="en_espera">En espera</option>
          <option value="firmado">Firmado</option>
          <option value="stand_by">Stand By</option>
          <option value="denegada">Denegada</option>
        </Select>
      </div>
      <TextArea name="justificacion" label="Justificación" value={v.justificacion} onChange={(e) => upd('justificacion', e.target.value)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="entregado" label="Entregado por" value={v.entregado} onChange={(e) => upd('entregado', e.target.value)} />
        <TextInput name="solicitado" label="Solicitado por" value={v.solicitado} onChange={(e) => upd('solicitado', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="fecha_firma" label="Fecha firma" type="date" value={v.fecha_firma} onChange={(e) => upd('fecha_firma', e.target.value)} />
        <TextInput name="fecha_entrega" label="Fecha entrega" type="date" value={v.fecha_entrega} onChange={(e) => upd('fecha_entrega', e.target.value)} />
        <TextInput name="quien_recibe" label="Quién recibe" value={v.quien_recibe} onChange={(e) => upd('quien_recibe', e.target.value)} />
      </div>

      {/* Multi-select de firmantes */}
      <fieldset className="rounded-md border border-sand p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Firmantes (board)</legend>
        {miembrosQuery.isLoading ? (
          <p className="text-xs text-dark-3">Cargando miembros…</p>
        ) : (miembrosQuery.data ?? []).length === 0 ? (
          <p className="text-xs text-dark-3">No hay miembros en miembros_board.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(miembrosQuery.data ?? []).map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm text-dark">
                <input
                  type="checkbox"
                  checked={miembroIds.includes(m.id)}
                  onChange={() => toggleMiembro(m.id)}
                  className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
                />
                <span>
                  <span className="font-medium">{m.codigo}</span>
                  <span className="ml-1 text-xs text-dark-3">{m.nombre}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {/* Document attachment only on existing firmas */}
      {initial?.id && (
        <div className="rounded-md border border-sand bg-sand-l/30 p-4">
          <DocumentAttachment entidadTipo="firmas" entidadId={initial.id} canEdit={true} label="Documento de la firma" />
        </div>
      )}

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear firma'}
        </button>
      </div>
    </form>
  );
}
