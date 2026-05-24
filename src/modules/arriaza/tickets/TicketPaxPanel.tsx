import { useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import {
  PAX_TIPOS,
  useCreateTicketPax,
  useDeleteTicketPax,
  useTicketPax,
} from './pax-api';

type Props = { ticketId: string; canEdit: boolean };

export function TicketPaxPanel({ ticketId, canEdit }: Props) {
  const query = useTicketPax(ticketId);
  const create = useCreateTicketPax(ticketId);
  const remove = useDeleteTicketPax(ticketId);
  const toast = useToast();

  const [tipo, setTipo] = useState<string>('AD');
  const [nombre, setNombre] = useState('');
  const [nacionalidad, setNacionalidad] = useState('');
  const [pasaporte, setPasaporte] = useState('');
  const [pasaporteExp, setPasaporteExp] = useState('');
  const [ffn, setFfn] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre del pasajero es obligatorio.');
      return;
    }
    try {
      await create.mutateAsync({
        tipo,
        nombre: nombre.trim(),
        nacionalidad: nacionalidad.trim() || null,
        pasaporte_num: pasaporte.trim() || null,
        pasaporte_exp: pasaporteExp || null,
        ffn: ffn.trim() || null,
      });
      setNombre('');
      setNacionalidad('');
      setPasaporte('');
      setPasaporteExp('');
      setFfn('');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  async function del(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch (e) {
      toast.error(describeError(e, 'delete'));
    }
  }

  const items = query.data ?? [];

  return (
    <fieldset className="rounded-md border border-sand bg-sand-l/30 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
        Pasajeros
      </legend>
      {canEdit && (
        <form onSubmit={add} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
          <Select name="pax_tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {PAX_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <TextInput name="pax_nombre" label="Nombre (pasaporte)" value={nombre} onChange={(e) => setNombre(e.target.value)} className="sm:col-span-2" />
          <TextInput name="pax_nac" label="Nacionalidad" value={nacionalidad} onChange={(e) => setNacionalidad(e.target.value)} />
          <TextInput name="pax_pass" label="N° pasaporte" value={pasaporte} onChange={(e) => setPasaporte(e.target.value)} />
          <TextInput name="pax_exp" label="Vto pasaporte" type="date" value={pasaporteExp} onChange={(e) => setPasaporteExp(e.target.value)} />
          <TextInput name="pax_ffn" label="FFN" value={ffn} onChange={(e) => setFfn(e.target.value)} hint="Frecuente" />
          <button
            type="submit"
            disabled={create.isPending}
            className="self-end rounded-md bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-60 sm:col-span-2"
          >
            ＋ Agregar pasajero
          </button>
        </form>
      )}

      {query.isLoading ? (
        <p className="text-xs text-dark-3">Cargando pasajeros…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-dark-3">Sin pasajeros registrados.</p>
      ) : (
        <ul className="divide-y divide-sand">
          {items.map((p, idx) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div className="flex-1">
                <span className="mr-2 font-mono text-xs text-dark-3">#{idx + 1}</span>
                <span className="rounded bg-sand-l px-1.5 py-0.5 text-[10px] font-semibold text-dark-2">{p.tipo ?? 'AD'}</span>
                <span className="ml-2 font-medium text-dark">{p.nombre}</span>
                {p.nacionalidad && <span className="ml-2 text-xs text-dark-3">· {p.nacionalidad}</span>}
                {p.pasaporte_num && <span className="ml-2 font-mono text-xs text-dark-3">PP {p.pasaporte_num}</span>}
                {p.pasaporte_exp && <span className="ml-2 text-xs text-dark-3">→ {p.pasaporte_exp}</span>}
                {p.ffn && <span className="ml-2 text-xs text-teal-d">✈ {p.ffn}</span>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void del(p.id)}
                  className="rounded-md border border-rust/40 px-2 py-0.5 text-xs text-rust hover:bg-rust-l"
                  title="Eliminar pasajero"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
