import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { SERVICE_META } from '../constants/serviceMeta';
import type { AttRuta, AttRutaInsert } from './api';

type Props = {
  open: boolean;
  viajeId: string;
  editing: AttRuta | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: AttRutaInsert) => void | Promise<void>;
};

export function RutaForm({ open, viajeId, editing, submitting, onClose, onSubmit }: Props) {
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNombre(editing.nombre ?? '');
      setFecha(editing.fecha ?? '');
      setDescripcion(editing.descripcion ?? '');
      setLink(editing.link ?? '');
    } else {
      setNombre('');
      setFecha('');
      setDescripcion('');
      setLink('');
    }
    setError(null);
  }, [open, editing]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre de la ruta es obligatorio.');
    if (!link.trim()) return setError('El link de Google Maps es obligatorio.');
    setError(null);
    void onSubmit({
      viaje_id: viajeId,
      nombre: nombre.trim(),
      fecha: fecha || null,
      descripcion: descripcion.trim() || null,
      link: link.trim(),
    });
  }

  const meta = SERVICE_META.ruta;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nueva'} Ruta`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput label="Nombre *" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Zurich → Lucerna" autoFocus />
        <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <TextArea label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Notas sobre la ruta" />
        <TextInput label="Link Google Maps *" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://maps.google.com/…" />
        {error && <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} style={{ backgroundColor: meta.solid }} className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? 'Guardando…' : '💾 Guardar Ruta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
