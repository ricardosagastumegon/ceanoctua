import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  liquidacionesApi,
  type LiqRowInsert,
  type LiquidacionInsert,
  type LiquidacionUpdate,
} from './api';

const keys = {
  all: ['caja_chica_liquidaciones'] as const,
  one: (id: string) => ['caja_chica_liquidaciones', id] as const,
  rows: (id: string) => ['caja_chica_liquidaciones', id, 'rows'] as const,
};

export function useLiquidaciones() {
  return useQuery({ queryKey: keys.all, queryFn: () => liquidacionesApi.list() });
}

export function useLiquidacion(id: string | undefined) {
  return useQuery({
    queryKey: id ? keys.one(id) : ['noop-liq'],
    queryFn: () => liquidacionesApi.get(id as string),
    enabled: !!id,
  });
}

export function useLiqRows(liqId: string | undefined) {
  return useQuery({
    queryKey: liqId ? keys.rows(liqId) : ['noop-rows'],
    queryFn: () => liquidacionesApi.listRows(liqId as string),
    enabled: !!liqId,
  });
}

export function useCreateLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, rows }: { input: LiquidacionInsert; rows: Omit<LiqRowInsert, 'liquidacion_id'>[] }) => {
      return liquidacionesApi.create(input).then(async (liq) => {
        if (rows.length > 0) await liquidacionesApi.replaceRows(liq.id, rows);
        return liq;
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      rows,
    }: {
      id: string;
      patch: LiquidacionUpdate;
      rows?: Omit<LiqRowInsert, 'liquidacion_id'>[];
    }) => {
      const updated = await liquidacionesApi.update(id, patch);
      if (rows) await liquidacionesApi.replaceRows(id, rows);
      return updated;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.one(vars.id) });
      void qc.invalidateQueries({ queryKey: keys.rows(vars.id) });
    },
  });
}

export function useDeleteLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => liquidacionesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useLinkedVales(liqId: string | undefined) {
  return useQuery({
    queryKey: liqId ? ['liq-vales', liqId] : ['noop-lv'],
    queryFn: () => liquidacionesApi.listLinkedVales(liqId as string),
    enabled: !!liqId,
  });
}

export function useReplaceLinkedVales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ liqId, valeIds }: { liqId: string; valeIds: string[] }) =>
      liquidacionesApi.replaceLinkedVales(liqId, valeIds),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['liq-vales', vars.liqId] });
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['caja_chica_vales'] });
    },
  });
}

export function useUploadLiqComprobante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => liquidacionesApi.uploadComprobante(id, file),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.one(vars.id) });
    },
  });
}

/**
 * Donde esta cada liquidacion respecto de Pagos. Es lo que decide si los
 * botones de FIRMA y PAGOS siguen vivos.
 *
 * Tres situaciones, y la tercera es la que hay que distinguir:
 *
 *   · `enSP`      el aviso ya se convirtio en solicitud de pago. Bloquea.
 *   · `enBandeja` el aviso espera en la bandeja de Pagos. Bloquea.
 *   · descartado  alguien le dio la ✕ en la bandeja: queda `procesado` pero
 *                 SIN pago. NO bloquea --si bloqueara, descartar un aviso
 *                 dejaria la liquidacion inservible para siempre--.
 *
 * El enlace al pago se lee por `pagos_notificaciones.pago_id`, que es el que
 * sobrevive cuando una SP agrupa varias liquidaciones. `pagos.origen_
 * notificacion_id` solo apunta a UNA de ellas.
 */
export type SituacionEnPagos = {
  /** La solicitud de pago en la que ya viaja, si llego a una. */
  sp: { serial: string | null; status: string | null } | null;
  /** Un aviso todavia sin procesar en la bandeja. Puede coexistir con `sp`
   *  --asi se ve un envio duplicado-- y es lo unico que se puede retirar. */
  pendienteId: string | null;
};

export function useLiquidacionesEnPagos() {
  return useQuery({
    queryKey: ['caja_chica_liquidaciones', 'en-pagos'],
    queryFn: async (): Promise<Map<string, SituacionEnPagos>> => {
      const { data: avisos, error } = await supabase
        .from('pagos_notificaciones')
        .select('id, origen_id, procesado, pago_id')
        .eq('origen_tipo', 'liquidacion');
      if (error) throw error;

      const ids = [...new Set((avisos ?? []).map((a) => a.pago_id).filter((x): x is string => !!x))];
      const sps = new Map<string, { serial: string | null; status: string | null }>();
      if (ids.length > 0) {
        // Las SP se piden aparte: un embed falla entero si la politica niega
        // una de las dos tablas, y preferimos perder el serial antes que la
        // respuesta completa.
        const { data: pagos } = await supabase
          .from('pagos')
          .select('id, serial, status')
          .in('id', ids)
          .is('deleted_at', null);
        for (const p of pagos ?? []) sps.set(p.id, { serial: p.serial, status: p.status });
      }

      const m = new Map<string, SituacionEnPagos>();
      for (const a of avisos ?? []) {
        const actual = m.get(a.origen_id) ?? { sp: null, pendienteId: null };
        const sp = a.pago_id ? sps.get(a.pago_id) : undefined;
        if (sp) actual.sp = sp;
        else if (!a.procesado) actual.pendienteId = a.id;
        if (actual.sp || actual.pendienteId) m.set(a.origen_id, actual);
      }
      return m;
    },
  });
}

/**
 * Retirar el aviso que todavia no se proceso. No borra: lo marca procesado
 * sin pago, que es exactamente lo que hace la ✕ de la bandeja --un aviso es
 * una bandeja de trabajo, no un documento-- y lo que lo saca de ahi.
 */
export function useRetirarDePagos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (avisoId: string) => {
      const { error } = await supabase
        .from('pagos_notificaciones')
        .update({ procesado: true, procesado_at: new Date().toISOString() })
        .eq('id', avisoId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['caja_chica_liquidaciones', 'en-pagos'] });
      void qc.invalidateQueries({ queryKey: ['pagos_notificaciones'] });
    },
  });
}
