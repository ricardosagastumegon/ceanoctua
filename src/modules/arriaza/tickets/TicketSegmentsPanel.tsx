import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TextInput } from '@/components/ui/TextInput';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import type { Database } from '@/types/database';

type Segment = Database['public']['Tables']['att_ticket_segments']['Row'];

type Props = { ticketId: string; canEdit: boolean };

export function TicketSegmentsPanel({ ticketId, canEdit }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const queryKey = ['att_ticket_segments', ticketId] as const;

  const query = useQuery<Segment[], Error>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('att_ticket_segments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('direccion')
        .order('orden', { ascending: true, nullsFirst: false })
        .order('fecha');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!ticketId,
  });

  const create = useMutation({
    mutationFn: async (input: Database['public']['Tables']['att_ticket_segments']['Insert']) => {
      const { error } = await supabase.from('att_ticket_segments').insert(input);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('att_ticket_segments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const [direccion, setDireccion] = useState<'dep' | 'ret'>('dep');
  const [origenIata, setOrigenIata] = useState('');
  const [origenCiudad, setOrigenCiudad] = useState('');
  const [destinoIata, setDestinoIata] = useState('');
  const [destinoCiudad, setDestinoCiudad] = useState('');
  const [fecha, setFecha] = useState('');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [vuelo, setVuelo] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!origenIata.trim() && !destinoIata.trim()) {
      toast.error('Captura al menos origen o destino IATA.');
      return;
    }
    try {
      await create.mutateAsync({
        ticket_id: ticketId,
        direccion,
        origen_iata: origenIata.trim().toUpperCase() || null,
        origen_ciudad: origenCiudad.trim() || null,
        destino_iata: destinoIata.trim().toUpperCase() || null,
        destino_ciudad: destinoCiudad.trim() || null,
        fecha: fecha || null,
        etd: etd || null,
        eta: eta || null,
        numero_vuelo: vuelo.trim().toUpperCase() || null,
      });
      setOrigenIata('');
      setOrigenCiudad('');
      setDestinoIata('');
      setDestinoCiudad('');
      setFecha('');
      setEtd('');
      setEta('');
      setVuelo('');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const items = query.data ?? [];
  const dep = items.filter((s) => s.direccion === 'dep');
  const ret = items.filter((s) => s.direccion === 'ret');

  return (
    <fieldset className="rounded-md border border-sand bg-sand-l/30 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
        Segmentos / escalas
      </legend>
      {canEdit && (
        <form onSubmit={add} className="mb-3 space-y-2 rounded-md border border-teal/30 bg-teal-l/30 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_1fr_2fr_1fr]">
            <Select name="seg_dir" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value as 'dep' | 'ret')}>
              <option value="dep">Ida</option>
              <option value="ret">Retorno</option>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <TextInput name="seg_oi" label="Origen IATA" value={origenIata} onChange={(e) => setOrigenIata(e.target.value)} maxLength={3} />
              <TextInput name="seg_oc" label="Ciudad" value={origenCiudad} onChange={(e) => setOrigenCiudad(e.target.value)} />
            </div>
            <div className="self-end pb-2 text-center text-dark-3">→</div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput name="seg_di" label="Destino IATA" value={destinoIata} onChange={(e) => setDestinoIata(e.target.value)} maxLength={3} />
              <TextInput name="seg_dc" label="Ciudad" value={destinoCiudad} onChange={(e) => setDestinoCiudad(e.target.value)} />
            </div>
            <TextInput name="seg_v" label="No. vuelo" value={vuelo} onChange={(e) => setVuelo(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <TextInput name="seg_f" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <TextInput name="seg_etd" label="ETD" type="time" value={etd} onChange={(e) => setEtd(e.target.value)} />
            <TextInput name="seg_eta" label="ETA" type="time" value={eta} onChange={(e) => setEta(e.target.value)} />
            <button
              type="submit"
              disabled={create.isPending}
              className="self-end rounded-md bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-60"
            >
              ＋ Agregar segmento
            </button>
          </div>
        </form>
      )}

      {query.isLoading ? (
        <p className="text-xs text-dark-3">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-dark-3">Sin segmentos. Solo se usan para vuelos multi-escala / multi-destino.</p>
      ) : (
        <div className="space-y-3">
          {dep.length > 0 && <SegmentList title="↗ Ida" items={dep} canEdit={canEdit} onDelete={(id) => void remove.mutateAsync(id)} />}
          {ret.length > 0 && <SegmentList title="↙ Retorno" items={ret} canEdit={canEdit} onDelete={(id) => void remove.mutateAsync(id)} />}
        </div>
      )}
    </fieldset>
  );
}

function SegmentList({
  title,
  items,
  canEdit,
  onDelete,
}: {
  title: string;
  items: Segment[];
  canEdit: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-dark-3">{title}</p>
      <ul className="divide-y divide-sand">
        {items.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div className="flex-1">
              <span className="font-mono font-semibold text-dark">{s.origen_iata ?? '???'}</span>
              <span className="mx-1 text-dark-3">→</span>
              <span className="font-mono font-semibold text-dark">{s.destino_iata ?? '???'}</span>
              {s.numero_vuelo && <span className="ml-2 rounded bg-sand-l px-1.5 py-0.5 text-[10px] font-semibold text-dark-2">{s.numero_vuelo}</span>}
              <div className="text-xs text-dark-3">
                {s.fecha ?? '—'} {s.etd && `· ETD ${s.etd}`} {s.eta && `· ETA ${s.eta}`}
                {(s.origen_ciudad || s.destino_ciudad) && (
                  <span className="ml-2">({s.origen_ciudad ?? '?'} → {s.destino_ciudad ?? '?'})</span>
                )}
              </div>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                className="rounded-md border border-rust/40 px-2 py-0.5 text-xs text-rust hover:bg-rust-l"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
