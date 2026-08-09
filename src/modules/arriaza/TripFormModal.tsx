import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { CountryPicker } from './shared/CountryPicker';
import type { AttViaje, AttViajeInsert } from './viajes/api';
import type { Database } from '@/types/database';

type Props = {
  open: boolean;
  editing: AttViaje | null; // null = crear · AttViaje = editar
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: AttViajeInsert) => void | Promise<void>;
};

// Modal Crear/Editar viaje · paridad con el modal tt-trip-modal del HTML.
// Campos: título, tripNo (readonly), fechas, país (autocomplete), destino,
// participantes, motivo. tripNo se genera en el trigger SQL al insert.
export function TripFormModal({ open, editing, submitting, onClose, onSubmit }: Props) {
  const [titulo, setTitulo] = useState('');
  const [fechaIni, setFechaIni] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [pais, setPais] = useState('');
  const [destino, setDestino] = useState('');
  const [participantes, setParticipantes] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitulo(editing.titulo ?? '');
      setFechaIni(editing.fecha_ini ?? '');
      setFechaFin(editing.fecha_fin ?? '');
      setPais(editing.pais ?? '');
      setDestino(editing.destino ?? '');
      setParticipantes(editing.acompanantes ?? '');
      setMotivo(editing.proposito ?? '');
    } else {
      setTitulo('');
      setFechaIni('');
      setFechaFin('');
      setPais('');
      setDestino('');
      setParticipantes('');
      setMotivo('');
    }
    setError(null);
  }, [open, editing]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setError('El título es obligatorio.');
    if (!fechaIni) return setError('La fecha de inicio es obligatoria.');
    if (!fechaFin) return setError('La fecha de fin es obligatoria.');
    if (fechaFin < fechaIni) return setError('La fecha fin no puede ser anterior al inicio.');
    if (!destino.trim()) return setError('El destino es obligatorio.');
    setError(null);
    const values: AttViajeInsert = {
      titulo: titulo.trim(),
      fecha_ini: fechaIni,
      fecha_fin: fechaFin,
      pais: pais || null,
      destino: destino.trim(),
      acompanantes: participantes.trim() || null,
      proposito: motivo.trim() || null,
      // estado (enum trip_status auto por fechas) queda en su default en la BD.
      estado: 'planificado' as Database['public']['Enums']['trip_status'],
    };
    void onSubmit(values);
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '✏️ Editar Viaje' : '➕ Crear Viaje'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput
          label="Título del viaje *"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej: Reunión de Junta Directiva — Miami"
          autoFocus
        />
        {editing?.trip_no && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
              No. de viaje
            </label>
            <div className="mt-1 rounded-md bg-teal-l px-3 py-2 text-sm font-extrabold text-teal-d">
              {editing.trip_no}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Fecha inicio *"
            type="date"
            value={fechaIni}
            onChange={(e) => setFechaIni(e.target.value)}
          />
          <TextInput
            label="Fecha fin *"
            type="date"
            value={fechaFin}
            min={fechaIni || undefined}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CountryPicker label="País de destino" value={pais} onChange={setPais} />
          <TextInput
            label="Destino *"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Ciudad(es) / lugar(es)"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Participantes"
            value={participantes}
            onChange={(e) => setParticipantes(e.target.value)}
            placeholder="Nombres separados por coma"
          />
          <TextInput
            label="Motivo del viaje"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Reunión anual de accionistas"
          />
        </div>
        {error && <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : editing ? '💾 Guardar cambios' : '💾 Crear viaje'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

