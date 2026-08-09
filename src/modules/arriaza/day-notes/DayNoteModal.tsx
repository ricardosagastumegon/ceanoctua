import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextArea } from '@/components/ui/TextArea';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { fmtDateLong } from '../utils';
import { attDayNotesApi } from './api';
import { useCreateAttDayNote, useUpdateAttDayNote, useDeleteAttDayNote } from './hooks';
import type { AttDayNote } from './api';

type Props = { open: boolean; onClose: () => void; viajeId: string; fecha: string };

export function DayNoteModal({ open, onClose, viajeId, fecha }: Props) {
  const [existing, setExisting] = useState<AttDayNote | null>(null);
  const [texto, setTexto] = useState('');
  const create = useCreateAttDayNote();
  const update = useUpdateAttDayNote();
  const remove = useDeleteAttDayNote();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    void attDayNotesApi.listByViaje(viajeId).then((all) => {
      const found = all.find((n) => n.fecha === fecha) ?? null;
      setExisting(found);
      setTexto(found?.texto ?? '');
    });
  }, [open, viajeId, fecha]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return toast.error('El texto de la nota no puede estar vacío.');
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, patch: { texto: texto.trim() } });
        toast.success('Nota actualizada.');
      } else {
        await create.mutateAsync({ viaje_id: viajeId, fecha, texto: texto.trim() });
        toast.success('Nota agregada.');
      }
      onClose();
    } catch (err) { toast.error(describeError(err)); }
  }

  async function del() {
    if (!existing) return;
    try { await remove.mutateAsync(existing.id); toast.success('Nota eliminada.'); onClose(); }
    catch (err) { toast.error(describeError(err, 'delete')); }
  }

  return (
    <Modal open={open} onClose={onClose} title={`📝 Nota del día · ${fmtDateLong(fecha)}`}>
      <form onSubmit={save} className="space-y-3">
        <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Ej: Vuelo tarde en la noche, cenar antes." />
        <div className="flex justify-between">
          {existing && (
            <button type="button" onClick={() => void del()} className="rounded-md border border-rust px-3 py-2 text-xs font-extrabold text-rust hover:bg-rust-l">
              🗑 Eliminar nota
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
            <button type="submit" className="rounded-md bg-teal px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-d">💾 Guardar</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
