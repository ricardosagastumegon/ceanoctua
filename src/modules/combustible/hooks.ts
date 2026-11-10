import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  facturasApi,
  reportesApi,
  responsablesApi,
  solicitudesApi,
  type Reporte,
  type ReporteInsert,
  type ReporteUpdate,
  type Factura,
  type FacturaInsert,
  type FacturaUpdate,
  type Responsable,
  type ResponsableInsert,
  type ResponsableUpdate,
  type Solicitud,
  type SolicitudInsert,
  type SolicitudUpdate,
} from './api';
import { ENVIOS_KEY, enviosApi } from '@/modules/tesoreria/api';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/modules/admin/hooks';

export const SOLICITUDES_KEY = ['comb_solicitudes'];

/** En qué bandeja está una solicitud de vale, y con quién. */
export type EnBandeja = { envioId: string; conQuien: string };

/**
 * Las solicitudes de vale que ahora mismo están en la bandeja de alguien.
 *
 * Una consulta para toda la tabla y no `useEnvioPendiente` por renglón: los
 * hooks no se llaman en un bucle, y además así el nombre de quien la tiene se
 * resuelve una vez. Ese nombre es la mitad del valor del botón --«retirar»
 * sin decir de dónde no le dice nada a nadie.
 */
export function useValesEnBandeja() {
  return useQuery({
    queryKey: [...ENVIOS_KEY, 'vales-pendientes'],
    queryFn: async (): Promise<Map<string, EnBandeja>> => {
      const { data, error } = await supabase
        .from('envios_vivos')
        .select('id, doc_id, destinatario_id')
        .eq('doc_tipo', 'comb_solicitud')
        .eq('estado', 'enviado');
      if (error) throw error;

      const ids = [...new Set((data ?? []).map((e) => e.destinatario_id))];
      const nombres = new Map<string, string>();
      if (ids.length > 0) {
        const { data: us } = await supabase
          .from('usuarios').select('id, nombre, email').in('id', ids);
        for (const u of us ?? []) nombres.set(u.id, u.nombre ?? u.email ?? 'alguien');
      }

      const m = new Map<string, EnBandeja>();
      for (const e of data ?? []) {
        m.set(e.doc_id, {
          envioId: e.id,
          conQuien: nombres.get(e.destinatario_id) ?? 'alguien',
        });
      }
      return m;
    },
  });
}

/**
 * Retirar devuelve la solicitud a borrador, así que la lista cambia también.
 */
export function useRetirarEnvio() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (envioId) => enviosApi.retirar(envioId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ENVIOS_KEY });
      void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY });
    },
  });
}
export const REPORTES_KEY = ['comb_reportes'];
export const RESPONSABLES_KEY = ['comb_responsables'];
export const FACTURAS_KEY = ['comb_facturas'];

export function useSolicitudes() {
  return useQuery<Solicitud[], Error>({
    queryKey: SOLICITUDES_KEY,
    queryFn: () => solicitudesApi.list(),
  });
}

export function useCrearSolicitud() {
  const qc = useQueryClient();
  return useMutation<Solicitud, Error, SolicitudInsert>({
    mutationFn: (input) => solicitudesApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY }),
  });
}

export function useActualizarSolicitud() {
  const qc = useQueryClient();
  return useMutation<Solicitud, Error, { id: string; patch: SolicitudUpdate }>({
    mutationFn: ({ id, patch }) => solicitudesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY }),
  });
}

/**
 * Borrar toca tres sitios: la lista, el total del control del que sale y la
 * bandeja del Tesorero, de donde se retira el envio. Invalidar solo la lista
 * deja la pantalla diciendo que el control tiene un vale que ya no existe.
 */
export function useBorrarSolicitud() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => solicitudesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY });
      void qc.invalidateQueries({ queryKey: REPORTES_KEY });
      void qc.invalidateQueries({ queryKey: ENVIOS_KEY });
    },
  });
}

export function useReportes() {
  return useQuery<Reporte[], Error>({ queryKey: REPORTES_KEY, queryFn: () => reportesApi.list() });
}

export function useCrearReporte() {
  const qc = useQueryClient();
  return useMutation<Reporte, Error, ReporteInsert>({
    mutationFn: (input) => reportesApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: REPORTES_KEY }),
  });
}

export function useActualizarReporte() {
  const qc = useQueryClient();
  return useMutation<Reporte, Error, { id: string; patch: ReporteUpdate }>({
    mutationFn: ({ id, patch }) => reportesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: REPORTES_KEY }),
  });
}

/**
 * Cerrar y enviar a Pagos tocan las dos tablas a la vez --el reporte cambia de
 * estado y sus solicitudes tambien-- asi que invalidan las dos listas. Sin
 * esto la pantalla muestra un control cerrado con sus renglones todavia en
 * «documentada», que es justo la clase de desfase que hace dudar del total.
 */
export function useCerrarReporte() {
  const qc = useQueryClient();
  return useMutation<Reporte, Error, string>({
    mutationFn: (id) => reportesApi.cerrar(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REPORTES_KEY });
      void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY });
    },
  });
}

/** Reabrir descongela el total y devuelve los vales a su estado. */
export function useReabrirReporte() {
  const qc = useQueryClient();
  return useMutation<Reporte, Error, string>({
    mutationFn: (id) => reportesApi.reabrir(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REPORTES_KEY });
      void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY });
    },
  });
}

/** Borrar el control suelta sus vales, asi que las dos listas cambian. */
export function useBorrarReporte() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => reportesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REPORTES_KEY });
      void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY });
    },
  });
}

export function useEnviarAPagos() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => reportesApi.enviarAPagos(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REPORTES_KEY });
      void qc.invalidateQueries({ queryKey: ['pagos_notificaciones'] });
    },
  });
}

export function useAsignarAReporte() {
  const qc = useQueryClient();
  return useMutation<void, Error, { ids: string[]; reporteId: string | null }>({
    mutationFn: ({ ids, reporteId }) => reportesApi.asignar(ids, reporteId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY });
      void qc.invalidateQueries({ queryKey: REPORTES_KEY });
    },
  });
}

export function useFacturas() {
  return useQuery<Factura[], Error>({ queryKey: FACTURAS_KEY, queryFn: () => facturasApi.list() });
}

/**
 * Crear, cambiar o borrar una factura mueve tambien los vales: su
 * `factura_id` y, por el trigger, su estado. Las dos listas se invalidan
 * juntas o la pantalla ensena un vale «documentada» colgando de una factura
 * que ya no esta.
 */
function invalidarFacturaYVales(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: FACTURAS_KEY });
  void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY });
}

export function useCrearFactura() {
  const qc = useQueryClient();
  return useMutation<Factura, Error, FacturaInsert>({
    mutationFn: (input) => facturasApi.create(input),
    onSuccess: () => invalidarFacturaYVales(qc),
  });
}

export function useActualizarFactura() {
  const qc = useQueryClient();
  return useMutation<Factura, Error, { id: string; patch: FacturaUpdate }>({
    mutationFn: ({ id, patch }) => facturasApi.update(id, patch),
    onSuccess: () => invalidarFacturaYVales(qc),
  });
}

export function useBorrarFactura() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => facturasApi.remove(id),
    onSuccess: () => invalidarFacturaYVales(qc),
  });
}

export function useFijarValesDeFactura() {
  const qc = useQueryClient();
  return useMutation<void, Error, { facturaId: string; solicitudIds: string[] }>({
    mutationFn: ({ facturaId, solicitudIds }) => facturasApi.fijarVales(facturaId, solicitudIds),
    onSuccess: () => invalidarFacturaYVales(qc),
  });
}

/**
 * Guardar una factura son siempre dos cosas: la factura y los vales que
 * cubre. Va junto en un hook porque se guarda desde dos pantallas --la lista
 * de facturas y la de vales-- y tener la pareja escrita dos veces es como se
 * acaba guardando la factura sin sus vales en una de las dos.
 */
export function useGuardarFactura() {
  const crear = useCrearFactura();
  const actualizar = useActualizarFactura();
  const fijar = useFijarValesDeFactura();

  async function guardar(
    id: string | null,
    valores: FacturaInsert,
    solicitudIds: string[],
  ): Promise<Factura> {
    const f = id
      ? await actualizar.mutateAsync({ id, patch: valores })
      : await crear.mutateAsync(valores);
    await fijar.mutateAsync({ facturaId: f.id, solicitudIds });
    return f;
  }

  return {
    guardar,
    guardando: crear.isPending || actualizar.isPending || fijar.isPending,
  };
}

/**
 * El índice único de `comb_facturas` da un mensaje de Postgres que no le dice
 * nada a nadie. Lo que pasó es sencillo y se puede decir con palabras.
 */
export function mensajeDeError(e: unknown): string {
  const m = describeError(e);
  return m.includes('comb_facturas_unica')
    ? 'Esa factura ya está registrada. Búscala en la lista y edítala.'
    : m;
}

export function useResponsables() {
  return useQuery<Responsable[], Error>({
    queryKey: RESPONSABLES_KEY,
    queryFn: () => responsablesApi.list(),
    staleTime: 5 * 60_000,
  });
}

export function useCrearResponsable() {
  const qc = useQueryClient();
  return useMutation<Responsable, Error, ResponsableInsert>({
    mutationFn: (input) => responsablesApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: RESPONSABLES_KEY }),
  });
}

export function useActualizarResponsable() {
  const qc = useQueryClient();
  return useMutation<Responsable, Error, { id: string; patch: ResponsableUpdate }>({
    mutationFn: ({ id, patch }) => responsablesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: RESPONSABLES_KEY }),
  });
}

export function useBorrarResponsable() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => responsablesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: RESPONSABLES_KEY }),
  });
}

/** Al enviar algo al Tesorero cambian la solicitud y su bandeja. */
export function useInvalidarTrasEnvio() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: SOLICITUDES_KEY });
    void qc.invalidateQueries({ queryKey: ENVIOS_KEY });
  };
}
