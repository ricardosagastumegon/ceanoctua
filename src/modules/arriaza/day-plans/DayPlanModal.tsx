import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { fmtDateLong } from '../utils';
import {
  useCreateAttDayPlan,
  useUpdateAttDayPlan,
  useAttDayPlanRows,
  useCreateAttDayPlanRow,
  useDeleteAttDayPlanRow,
} from './hooks';
import { attDayPlansApi } from './api';
import type { AttDayPlan } from './api';

type Props = {
  open: boolean;
  onClose: () => void;
  viajeId: string;
  fecha: string;
};

// Modal para editar el "Itinerario detallado del día" · paridad con
// tt-dayplan-modal + rows Horario|Itinerario del HTML.
export function DayPlanModal({ open, onClose, viajeId, fecha }: Props) {
  const create = useCreateAttDayPlan();
  const update = useUpdateAttDayPlan();
  const [plan, setPlan] = useState<AttDayPlan | null>(null);
  const [dia, setDia] = useState('');
  const [lugar, setLugar] = useState('');
  const rowsQuery = useAttDayPlanRows(plan?.id);
  const createRow = useCreateAttDayPlanRow();
  const removeRow = useDeleteAttDayPlanRow();
  const toast = useToast();

  // Draft para agregar nueva fila.
  const [newHorario, setNewHorario] = useState('');
  const [newItin, setNewItin] = useState('');

  useEffect(() => {
    if (!open) return;
    // Cargar plan existente o preparar creación.
    void attDayPlansApi.listByViaje(viajeId).then((all) => {
      const existing = all.find((p) => p.fecha === fecha);
      if (existing) {
        setPlan(existing);
        setDia(existing.dia ?? '');
        setLugar(existing.lugar ?? '');
      } else {
        setPlan(null);
        setDia('');
        setLugar('');
      }
    });
  }, [open, viajeId, fecha]);

  async function ensurePlan(): Promise<AttDayPlan> {
    if (plan) return plan;
    const created = await create.mutateAsync({ viaje_id: viajeId, fecha, dia: dia || null, lugar: lugar || null });
    setPlan(created);
    return created;
  }

  async function savePlanMeta(e: FormEvent) {
    e.preventDefault();
    try {
      if (plan) {
        await update.mutateAsync({ id: plan.id, patch: { dia: dia || null, lugar: lugar || null } });
      } else {
        await ensurePlan();
      }
      toast.success('Día actualizado.');
    } catch (err) { toast.error(describeError(err)); }
  }

  async function addRow(e: FormEvent) {
    e.preventDefault();
    if (!newHorario.trim() && !newItin.trim()) return;
    try {
      const p = await ensurePlan();
      await createRow.mutateAsync({
        day_plan_id: p.id,
        horario: newHorario || null,
        itinerario: newItin.trim() || null,
      });
      setNewHorario(''); setNewItin('');
    } catch (err) { toast.error(describeError(err)); }
  }

  async function delRow(id: string) {
    if (!plan) return;
    try { await removeRow.mutateAsync({ id, dayPlanId: plan.id }); } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  const rows = rowsQuery.data ?? [];

  return (
    <Modal open={open} onClose={onClose} title={`📅 Itinerario del día · ${fmtDateLong(fecha)}`} size="lg">
      <form onSubmit={savePlanMeta} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Etiqueta del día" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="Día 3, día libre…" />
          <TextInput label="Lugar / ciudad" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Andorra – Rocamadour" />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="rounded-md bg-teal px-3 py-1 text-xs font-extrabold text-white hover:bg-teal-d">Guardar meta del día</button>
        </div>
      </form>

      <div className="mt-4 rounded-md border border-sand p-3">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-teal-d">Filas Horario | Itinerario</div>
        {rows.length === 0 && <div className="text-xs italic text-dark-3">Aún no hay filas para este día.</div>}
        {rows.map((r) => (
          <div key={r.id} className="mb-1 flex items-center gap-2 rounded-md bg-sand-l px-2 py-1 text-xs">
            <div className="w-16 shrink-0 font-extrabold text-teal-d">{r.horario ?? '—'}</div>
            <div className="flex-1 text-dark-2">{r.itinerario ?? '—'}</div>
            {r.es_auto_reunion ? (
              <span className="rounded-full bg-purple/10 px-2 text-[10px] font-extrabold text-purple">reunión</span>
            ) : (
              <button type="button" onClick={() => void delRow(r.id)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust" title="Eliminar">🗑</button>
            )}
          </div>
        ))}

        <form onSubmit={addRow} className="mt-2 flex gap-2">
          <TextInput type="time" value={newHorario} onChange={(e) => setNewHorario(e.target.value)} className="w-32" />
          <TextInput value={newItin} onChange={(e) => setNewItin(e.target.value)} placeholder="Ej: Desayuno en el hotel" className="flex-1" />
          <button type="submit" className="rounded-md bg-teal px-3 py-1 text-xs font-extrabold text-white hover:bg-teal-d">+ Fila</button>
        </form>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cerrar</button>
      </div>
    </Modal>
  );
}
