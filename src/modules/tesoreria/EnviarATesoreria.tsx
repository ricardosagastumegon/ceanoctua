import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { ENVIOS_KEY, enviosApi, type DocTipo, type Snapshot } from './api';

/**
 * El cuadro de «enviar a tesoreria», compartido.
 *
 * Lo usan el combustible y Pagos, y lo usara caja chica. Esta aqui y no en un
 * modulo concreto porque enviar no es una funcion de quien manda: es la
 * frontera entre dos espacios, y conviene que haya una sola.
 */

/** Los usuarios que pueden recibir. Hoy: tesoreria y el administrador. */
export function useDestinatariosTesoreria() {
  return useQuery({
    queryKey: ['usuarios_tesoreria'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol')
        .eq('activo', true);
      if (error) throw error;
      return (data ?? []).filter((u) => u.rol === 'tesoreria');
    },
  });
}

/** Si un documento ya está en la bandeja de alguien, para no mandarlo dos veces. */
export function useEnvioPendiente(docTipo: DocTipo, docId: string | null) {
  return useQuery({
    queryKey: [...ENVIOS_KEY, 'doc', docTipo, docId],
    enabled: docId != null,
    queryFn: async () => {
      const envios = await enviosApi.porDocumento(docTipo, docId as string);
      return envios.find((e) => e.estado === 'enviado') ?? null;
    },
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  docTipo: DocTipo;
  docId: string;
  snapshot: Snapshot;
  titulo?: string;
  /** Qué pasa después de enviar: normalmente mover el estado del documento. */
  onEnviado?: () => Promise<void> | void;
};

export function EnviarATesoreriaModal({
  open,
  onClose,
  docTipo,
  docId,
  snapshot,
  titulo = 'Enviar a tesorería',
  onEnviado,
}: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const destinatariosQ = useDestinatariosTesoreria();
  const destinatarios = destinatariosQ.data ?? [];
  const [destinatario, setDestinatario] = useState('');
  const [nota, setNota] = useState('');

  const elegido = destinatario || destinatarios[0]?.id || '';

  const enviar = useMutation({
    mutationFn: async () => {
      await enviosApi.enviar({
        destinatarioId: elegido,
        docTipo,
        docId,
        snapshot,
        nota: nota.trim() || null,
      });
      await onEnviado?.();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ENVIOS_KEY });
      toast.success('Enviado a tesorería.');
      setNota('');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={titulo} size="sm">
      <div className="space-y-4">
        <div className="rounded-md border border-sand bg-sand-l/40 p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-dark">{snapshot.serial ?? '—'}</span>
            {snapshot.monto != null && (
              <span className="font-semibold text-dark">{formatMoney(snapshot.monto)}</span>
            )}
          </div>
          {snapshot.detalle && <p className="mt-1 text-dark-2">{snapshot.detalle}</p>}
        </div>

        <p className="text-xs text-dark-3">
          Verá una copia de estos datos en su bandeja. No se le da acceso a esta pantalla
          ni a la tabla de donde salen.
        </p>

        {destinatarios.length === 0 ? (
          <p className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-dark-2">
            No hay ningún usuario de tesorería todavía. Se crea en{' '}
            <strong>Admin → Usuarios y accesos</strong>, con rol <code>tesoreria</code>.
          </p>
        ) : (
          <Select
            label="Destinatario"
            value={elegido}
            onChange={(e) => setDestinatario(e.target.value)}
          >
            {destinatarios.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre ?? d.email}
              </option>
            ))}
          </Select>
        )}

        <TextArea
          label="Nota"
          rows={2}
          placeholder="Opcional"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm text-dark-2 hover:bg-sand-l"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!elegido || enviar.isPending}
            onClick={() => enviar.mutate()}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-60"
          >
            {enviar.isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
