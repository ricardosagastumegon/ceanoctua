import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  reportesApi,
  responsablesApi,
  solicitudesApi,
  type Reporte,
  type ReporteInsert,
  type ReporteUpdate,
  type Responsable,
  type ResponsableInsert,
  type ResponsableUpdate,
  type Solicitud,
  type SolicitudInsert,
  type SolicitudUpdate,
} from './api';
import { ENVIOS_KEY } from '@/modules/tesoreria/api';

export const SOLICITUDES_KEY = ['comb_solicitudes'];
export const REPORTES_KEY = ['comb_reportes'];
export const RESPONSABLES_KEY = ['comb_responsables'];

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
