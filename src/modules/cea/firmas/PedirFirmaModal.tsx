import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { useCreateFirma } from './hooks';
import type { FirmaInsert } from './api';

/**
 * A quién se le pide la firma.
 *
 * Antes la firma se creaba sin destinatario y el tablero de quien firma
 * mostraba todas las que estuvieran en espera. Funcionaba porque hay una sola
 * persona firmando; con dos, cada quien vería los documentos del otro.
 *
 * El listado sale de `firmantes()` --una función en la base-- y no de la
 * tabla de usuarios: las políticas solo dejan a cada quien leer su propia
 * fila, así que sin eso el selector saldría vacío para quien no sea admin.
 */

export function useFirmantes() {
  return useQuery({
    queryKey: ['firmantes'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ id: string; nombre: string | null }[]> => {
      const { data, error } = await supabase.rpc('firmantes');
      if (error) throw error;
      return (data ?? []) as { id: string; nombre: string | null }[];
    },
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Lo que se va a firmar, ya armado salvo el destinatario y la urgencia. */
  base: Omit<FirmaInsert, 'asignada_a' | 'urgencia'>;
  /** Para el título del diálogo. */
  documento: string;
  onHecho?: () => void;
};

export function PedirFirmaModal({ open, onClose, base, documento, onHecho }: Props) {
  const firmantesQ = useFirmantes();
  const crear = useCreateFirma();
  const toast = useToast();
  const [quien, setQuien] = useState('');
  const [urgencia, setUrgencia] = useState('importante');
  const [nota, setNota] = useState('');

  const lista = firmantesQ.data ?? [];

  // Con un solo firmante no tiene sentido hacerla elegir.
  useEffect(() => {
    if (open && !quien && lista.length === 1) setQuien(lista[0].id);
  }, [open, lista, quien]);

  async function enviar() {
    if (!quien) {
      toast.error('Elige a quién se le pide la firma.');
      return;
    }
    try {
      await crear.mutateAsync({
        input: {
          ...base,
          asignada_a: quien,
          urgencia: urgencia as FirmaInsert['urgencia'],
          justificacion: [base.justificacion, nota.trim() || null].filter(Boolean).join(' · ') || null,
        },
        miembroIds: [],
      });
      toast.success('Enviada a firma.');
      setQuien('');
      setNota('');
      onHecho?.();
      onClose();
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="✍️ Pedir firma" size="md">
      <div className="space-y-4">
        <p className="rounded-md border border-sand bg-sand-l/50 px-3 py-2 text-sm text-dark-2">
          Documento: <b className="text-dark">{documento}</b>
        </p>

        <Select
          name="quien"
          label="¿Quién debe firmarlo? *"
          value={quien}
          onChange={(e) => setQuien(e.target.value)}
        >
          <option value="">— Seleccionar —</option>
          {lista.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre ?? '(sin nombre)'}
            </option>
          ))}
        </Select>

        {lista.length === 0 && !firmantesQ.isLoading && (
          <p className="text-[11px] text-rust">
            No hay nadie con permiso de firmar. Dale a esa persona el módulo CEA en nivel editor
            desde Admin → Usuarios y accesos.
          </p>
        )}

        <Select
          name="urgencia"
          label="Urgencia"
          value={urgencia}
          onChange={(e) => setUrgencia(e.target.value)}
        >
          <option value="urgente">Urgente</option>
          <option value="importante">Importante</option>
          <option value="programado">Programado</option>
        </Select>

        <TextInput
          name="nota"
          label="Nota para quien firma"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Opcional: algo que deba saber antes de firmar"
        />

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={crear.isPending || !quien}
            className="rounded-md bg-teal px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-d disabled:opacity-50"
          >
            {crear.isPending ? 'Enviando…' : 'Enviar a firma'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
