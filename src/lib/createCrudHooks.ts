import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Standard CRUD API shape that every module exposes.
 * Optional extras live in the module-specific hooks file alongside.
 */
export type CrudApi<Row extends { id: string }, Insert, Update> = {
  list(): Promise<Row[]>;
  create(input: Insert): Promise<Row>;
  update(id: string, patch: Update): Promise<Row>;
  remove(id: string): Promise<void>;
};

export type CrudHooks<Row extends { id: string }, Insert, Update> = {
  queryKey: QueryKey;
  useList(): ReturnType<typeof useQuery<Row[], Error>>;
  useCreate(): ReturnType<typeof useMutation<Row, Error, Insert>>;
  useUpdate(): ReturnType<typeof useMutation<Row, Error, { id: string; patch: Update }>>;
  useDelete(): ReturnType<typeof useMutation<void, Error, string>>;
};

/**
 * Factory that builds the standard list/create/update/delete React Query hooks
 * for any module whose API matches CrudApi<Row, Insert, Update>.
 *
 * Use this for simple modules. For modules with extra mutations (assign,
 * advance step, upload, replace rows, etc.) keep a hand-written hooks file
 * and import only what you need from this factory.
 */
export function createCrudHooks<Row extends { id: string }, Insert, Update>(
  key: string,
  api: CrudApi<Row, Insert, Update>,
): CrudHooks<Row, Insert, Update> {
  const queryKey: QueryKey = [key];

  function useList() {
    return useQuery<Row[], Error>({ queryKey, queryFn: () => api.list() });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation<Row, Error, Insert>({
      mutationFn: (input) => api.create(input),
      onSuccess: () => void qc.invalidateQueries({ queryKey }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation<Row, Error, { id: string; patch: Update }>({
      mutationFn: ({ id, patch }) => api.update(id, patch),
      onSuccess: () => void qc.invalidateQueries({ queryKey }),
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    return useMutation<void, Error, string>({
      mutationFn: (id) => api.remove(id),
      onSuccess: () => void qc.invalidateQueries({ queryKey }),
    });
  }

  return { queryKey, useList, useCreate, useUpdate, useDelete };
}

/**
 * Strip auto-generated fields (serial, created_at, etc.) from an Insert
 * payload so the DB defaults take precedence. Use in api.create() to avoid
 * accidental client-side overrides of server-generated values.
 *
 * Preserves the original type so Supabase's strict Insert signatures are
 * still satisfied at the call site.
 */
export function stripServerGenerated<T extends object>(
  input: T,
  fields: ReadonlyArray<string>,
): T {
  const out = { ...input } as Record<string, unknown>;
  for (const f of fields) {
    if (f in out) delete out[f];
  }
  return out as T;
}
