import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  aeronavesApi,
  documentosApi,
  tiposCertificadoApi,
  type AeronaveInsert,
  type AeronaveUpdate,
  type DocumentoInsert,
  type DocumentoUpdate,
} from './api';

export const aeronavesKey = ['avn_aeronaves'] as const;
export const documentosKey = (aeronaveId: string) => ['avn_documentos', aeronaveId] as const;
export const tiposCertificadoKey = ['avn_tipos_certificado'] as const;

export function useAeronaves() {
  return useQuery({ queryKey: aeronavesKey, queryFn: aeronavesApi.list });
}

/**
 * La aeronave por su matrícula, que es lo que viene en la dirección.
 *
 * Se resuelve desde la lista ya cargada cuando está disponible, para que
 * entrar y salir de una aeronave no dispare una consulta cada vez.
 */
export function useAeronave(matricula: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['avn_aeronave', matricula],
    enabled: !!matricula,
    queryFn: async () => {
      const lista = qc.getQueryData<Awaited<ReturnType<typeof aeronavesApi.list>>>(aeronavesKey);
      const enCache = lista?.find((a) => a.matricula === matricula);
      if (enCache) return enCache;
      return aeronavesApi.byMatricula(matricula as string);
    },
  });
}

export function useTiposCertificado() {
  return useQuery({ queryKey: tiposCertificadoKey, queryFn: tiposCertificadoApi.list });
}

export function useDocumentos(aeronaveId: string | undefined) {
  return useQuery({
    queryKey: documentosKey(aeronaveId ?? ''),
    enabled: !!aeronaveId,
    queryFn: () => documentosApi.byAeronave(aeronaveId as string),
  });
}

function useInvalidarAeronaves() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: aeronavesKey });
    void qc.invalidateQueries({ queryKey: ['avn_aeronave'] });
  };
}

export function useCrearAeronave() {
  const invalidar = useInvalidarAeronaves();
  return useMutation({
    mutationFn: (input: AeronaveInsert) => aeronavesApi.create(input),
    onSuccess: invalidar,
  });
}

export function useActualizarAeronave() {
  const invalidar = useInvalidarAeronaves();
  return useMutation({
    mutationFn: (v: { id: string; patch: AeronaveUpdate }) => aeronavesApi.update(v.id, v.patch),
    onSuccess: invalidar,
  });
}

export function useBorrarAeronave() {
  const invalidar = useInvalidarAeronaves();
  return useMutation({
    mutationFn: (id: string) => aeronavesApi.remove(id),
    onSuccess: invalidar,
  });
}

export function useCrearDocumento(aeronaveId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentoInsert) => documentosApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: documentosKey(aeronaveId) }),
  });
}

export function useActualizarDocumento(aeronaveId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: DocumentoUpdate }) => documentosApi.update(v.id, v.patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: documentosKey(aeronaveId) }),
  });
}

export function useBorrarDocumento(aeronaveId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentosApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: documentosKey(aeronaveId) }),
  });
}
