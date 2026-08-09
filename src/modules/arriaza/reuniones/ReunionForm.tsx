import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { SERVICE_META } from '../constants/serviceMeta';
import type { AttReunion, AttReunionInsert } from './api';

type Props = {
  open: boolean;
  viajeId: string;
  editing: AttReunion | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: AttReunionInsert) => void | Promise<void>;
};

// Reunión · al guardar, se sincroniza automáticamente al att_day_plan_rows
// del día correspondiente (lógica en syncReunionToDayPlan del api.ts).
export function ReunionForm({ open, viajeId, editing, submitting, onClose, onSubmit }: Props) {
  const [cita, setCita] = useState('');
  const [asunto, setAsunto] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [participantes, setParticipantes] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCita(editing.cita ?? '');
      setAsunto(editing.asunto ?? '');
      setFecha(editing.fecha ?? '');
      setHora(editing.hora ?? '');
      setParticipantes(editing.participantes ?? '');
      setCiudad(editing.ciudad ?? '');
      setDireccion(editing.direccion ?? '');
    } else {
      setCita('');
      setAsunto('');
      setFecha('');
      setHora('');
      setParticipantes('');
      setCiudad('');
      setDireccion('');
    }
    setError(null);
  }, [open, editing]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cita.trim()) return setError('El nombre de la cita es obligatorio.');
    if (!fecha) return setError('La fecha es obligatoria.');
    if (!hora) return setError('La hora es obligatoria.');
    setError(null);
    void onSubmit({
      viaje_id: viajeId,
      cita: cita.trim(),
      asunto: asunto.trim() || null,
      fecha,
      hora,
      participantes: participantes.trim() || null,
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
    });
  }

  const meta = SERVICE_META.reunion;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nueva'} Reunión`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput label="Cita *" value={cita} onChange={(e) => setCita(e.target.value)} placeholder="Ej: Reunión con socios locales" autoFocus />
        <TextInput label="Asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Detalle del asunto" />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Fecha *" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <TextInput label="Hora *" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        <TextInput label="Participantes" value={participantes} onChange={(e) => setParticipantes(e.target.value)} placeholder="Nombres" />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
          <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Lugar de reunión" />
        </div>
        <div className="rounded-md border border-purple/25 bg-purple/5 px-3 py-2 text-xs font-semibold text-purple">
          ℹ️ Al guardar, esta cita se agrega automáticamente al Itinerario del día correspondiente.
        </div>
        {error && <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} style={{ backgroundColor: meta.solid }} className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? 'Guardando…' : '💾 Guardar Reunión'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
