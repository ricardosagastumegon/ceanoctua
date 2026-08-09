import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { SERVICE_META } from '../constants/serviceMeta';
import type { AttTienda, AttTiendaInsert } from './api';

type Props = {
  open: boolean;
  viajeId: string;
  editing: AttTienda | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: AttTiendaInsert) => void | Promise<void>;
};

// Modal Crear/Editar Tienda · paridad con tt-tienda-modal del HTML.
// Servicio sin costo — solo info (nombre, ubicación, horario, detalle).
export function TiendaForm({ open, viajeId, editing, submitting, onClose, onSubmit }: Props) {
  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [apertura, setApertura] = useState('');
  const [cierre, setCierre] = useState('');
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNombre(editing.nombre ?? '');
      setCiudad(editing.ciudad ?? '');
      setDireccion(editing.direccion ?? '');
      setTelefono(editing.telefono ?? '');
      setApertura(editing.apertura ?? '');
      setCierre(editing.cierre ?? '');
      setDetalle(editing.detalle ?? '');
    } else {
      setNombre('');
      setCiudad('');
      setDireccion('');
      setTelefono('');
      setApertura('');
      setCierre('');
      setDetalle('');
    }
    setError(null);
  }, [open, editing]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre de la tienda es obligatorio.');
    setError(null);
    const values: AttTiendaInsert = {
      viaje_id: viajeId,
      nombre: nombre.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      apertura: apertura || null,
      cierre: cierre || null,
      detalle: detalle.trim() || null,
    };
    void onSubmit(values);
  }

  const meta = SERVICE_META.tiendas;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nueva'} Tienda`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Nombre *"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Bucherer"
            autoFocus
          />
          <TextInput
            label="Ciudad"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            placeholder="Ciudad"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Dirección"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
          <TextInput
            label="Teléfono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+41 …"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Apertura (hh:mm)"
            type="time"
            value={apertura}
            onChange={(e) => setApertura(e.target.value)}
          />
          <TextInput
            label="Cierre (hh:mm)"
            type="time"
            value={cierre}
            onChange={(e) => setCierre(e.target.value)}
          />
        </div>
        <TextArea
          label="Detalle"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          rows={3}
          placeholder="Notas sobre la visita, productos de interés, etc."
        />
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
            style={{ backgroundColor: meta.solid }}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : `💾 Guardar Tienda`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
