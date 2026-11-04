import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  viajerosApi,
  type AfiliacionInsert,
  type Duenio,
  type PasaporteInsert,
  type VisaInsert,
} from './api';

const keys = {
  pasaportes: ['viajero_pasaportes'] as const,
  visas: ['viajero_visas'] as const,
  afiliaciones: ['viajero_afiliaciones'] as const,
};

export function usePasaportes() {
  return useQuery({ queryKey: keys.pasaportes, queryFn: () => viajerosApi.pasaportes() });
}

export function useVisas() {
  return useQuery({ queryKey: keys.visas, queryFn: () => viajerosApi.visas() });
}

export function useAfiliaciones() {
  return useQuery({ queryKey: keys.afiliaciones, queryFn: () => viajerosApi.afiliaciones() });
}

/**
 * Las dos listas se invalidan juntas.
 *
 * La pantalla muestra a cada persona con sus pasaportes y sus visas en el
 * mismo panel, así que tocar una sin refrescar la otra deja medio panel
 * viejo, que es peor que recargar las dos.
 */
function useRefrescar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.pasaportes });
    void qc.invalidateQueries({ queryKey: keys.visas });
    void qc.invalidateQueries({ queryKey: keys.afiliaciones });
  };
}

export function useGuardarPasaporte() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async (v: {
      id?: string;
      duenio: Duenio;
      valores: Omit<PasaporteInsert, 'persona_id' | 'invitado_id'>;
    }) => {
      if (v.id) return viajerosApi.actualizarPasaporte(v.id, v.valores);
      return viajerosApi.crearPasaporte(v.duenio, v.valores);
    },
    onSuccess: refrescar,
  });
}

export function useGuardarVisa() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async (v: {
      id?: string;
      duenio: Duenio;
      valores: Omit<VisaInsert, 'persona_id' | 'invitado_id'>;
    }) => {
      if (v.id) return viajerosApi.actualizarVisa(v.id, v.valores);
      return viajerosApi.crearVisa(v.duenio, v.valores);
    },
    onSuccess: refrescar,
  });
}

export function useBorrarPasaporte() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) => viajerosApi.borrarPasaporte(id),
    onSuccess: refrescar,
  });
}

export function useBorrarVisa() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) => viajerosApi.borrarVisa(id),
    onSuccess: refrescar,
  });
}

export function useGuardarAfiliacion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async (v: {
      id?: string;
      duenio: Duenio;
      valores: Omit<AfiliacionInsert, 'persona_id' | 'invitado_id'>;
    }) => {
      if (v.id) return viajerosApi.actualizarAfiliacion(v.id, v.valores);
      return viajerosApi.crearAfiliacion(v.duenio, v.valores);
    },
    onSuccess: refrescar,
  });
}

export function useBorrarAfiliacion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) => viajerosApi.borrarAfiliacion(id),
    onSuccess: refrescar,
  });
}

export function useSubirImagen() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (v: { carpeta: 'pasaportes' | 'visas'; id: string; file: File }) =>
      viajerosApi.subirImagen(v.carpeta, v.id, v.file),
    onSuccess: refrescar,
  });
}
