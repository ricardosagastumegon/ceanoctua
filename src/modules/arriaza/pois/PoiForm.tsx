import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { SERVICE_META } from '../constants/serviceMeta';
import type { AttPoi, AttPoiInsert, PoiPunto } from './api';
import { readPoiPuntos } from './api';

type Props = {
  open: boolean;
  viajeId: string;
  editing: AttPoi | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: AttPoiInsert) => void | Promise<void>;
};

// POI · lista de puntos dinámica (paridad ttOpenPoiModal + rows).
export function PoiForm({ open, viajeId, editing, submitting, onClose, onSubmit }: Props) {
  const [titulo, setTitulo] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [puntos, setPuntos] = useState<PoiPunto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitulo(editing.titulo ?? '');
      setCiudad(editing.ciudad ?? '');
      const existing = readPoiPuntos(editing);
      setPuntos(existing.length ? existing : [{ nombre: '', descripcion: '' }]);
    } else {
      setTitulo('');
      setCiudad('');
      setPuntos([{ nombre: '', descripcion: '' }]);
    }
    setError(null);
  }, [open, editing]);

  function updatePunto(i: number, field: keyof PoiPunto, val: string) {
    setPuntos((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  }
  function addPunto() { setPuntos((p) => [...p, { nombre: '', descripcion: '' }]); }
  function removePunto(i: number) { setPuntos((p) => p.filter((_, idx) => idx !== i)); }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setError('El título es obligatorio.');
    setError(null);
    const filtered = puntos.filter((p) => (p.nombre ?? '').trim() || (p.descripcion ?? '').trim());
    void onSubmit({
      viaje_id: viajeId,
      titulo: titulo.trim(),
      ciudad: ciudad.trim() || null,
      puntos: filtered as unknown as import('@/types/database').Json,
    });
  }

  const meta = SERVICE_META.poi;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nueva'} lista de Puntos de Interés`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Título *" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Imperdibles en Zurich" autoFocus />
          <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </div>

        <div>
          <div className="mb-1 text-xs font-extrabold uppercase tracking-wider text-dark-2">Puntos</div>
          {puntos.map((p, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1.6fr_32px] gap-2">
              <TextInput
                value={p.nombre ?? ''}
                onChange={(e) => updatePunto(i, 'nombre', e.target.value)}
                placeholder="Nombre del lugar"
              />
              <TextInput
                value={p.descripcion ?? ''}
                onChange={(e) => updatePunto(i, 'descripcion', e.target.value)}
                placeholder="Por qué vale la pena, tip, horario…"
              />
              <button
                type="button"
                onClick={() => removePunto(i)}
                title="Quitar"
                className="rounded-md border border-sand px-2 text-xs text-dark-3 hover:border-rust hover:text-rust"
              >
                🗑
              </button>
            </div>
          ))}
          <button type="button" onClick={addPunto} className="text-xs font-semibold text-teal-d hover:underline">
            + Agregar punto
          </button>
        </div>

        {error && <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} style={{ backgroundColor: meta.solid }} className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? 'Guardando…' : '💾 Guardar lista'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
