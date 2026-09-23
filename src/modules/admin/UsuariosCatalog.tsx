import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import type { AppRol, Modulo, Permiso } from '@/types';

/**
 * Quién entra a CEA y a qué.
 *
 * La cuenta de acceso se crea en el panel de Supabase, no aquí: hacerlo desde
 * el navegador exigiría la llave `service_role`, que no puede viajar al
 * cliente. Un usuario recién creado aparece solo en esta lista, con rol
 * `solo_lectura` y sin un módulo asignado -- o sea, sin ver nada -- hasta que
 * aquí se le dé acceso.
 *
 * Lo que se marca en esta pantalla es lo que de verdad manda: las políticas de
 * la base leen `usuario_modulos`. El menú solo dibuja lo que ya está permitido.
 */

const MODULOS: { key: Modulo; label: string; grupo: string }[] = [
  { key: 'tt', label: 'Arriaza T&T', grupo: 'Módulos' },
  { key: 'cea', label: 'CEA', grupo: 'Módulos' },
  { key: 'finanzas', label: 'Finanzas', grupo: 'Módulos' },
  { key: 'caja_chica', label: 'Caja Chica', grupo: 'Módulos' },
  { key: 'miel_sj', label: 'Miel SJ', grupo: 'Módulos' },
  { key: 'dashboard', label: 'Dashboard', grupo: 'Módulos' },
  { key: 'maa', label: 'MAA · Presidencia', grupo: 'Tableros del board' },
  { key: 'ja', label: 'JA · Gerencia Agrícola', grupo: 'Tableros del board' },
  { key: 'la', label: 'LA · Gerencia Administrativa', grupo: 'Tableros del board' },
  { key: 'jm', label: 'JM · Gerencia LUM', grupo: 'Tableros del board' },
  { key: 'aa', label: 'AA · Board', grupo: 'Tableros del board' },
  { key: 'eg', label: 'EG · Gerente General', grupo: 'Tableros del board' },
  { key: 'pe', label: 'PE · Board', grupo: 'Tableros del board' },
];

const NIVELES: { key: Permiso; label: string; pie: string }[] = [
  { key: 'observador', label: 'Observador', pie: 'Ve, imprime y descarga' },
  { key: 'editor', label: 'Editor', pie: 'Además crea y edita' },
  { key: 'super', label: 'Super', pie: 'Además borra' },
];

type UsuarioFila = {
  id: string;
  nombre: string | null;
  rol: AppRol;
  activo: boolean;
};

function useUsuarios() {
  return useQuery({
    queryKey: ['admin', 'usuarios'],
    queryFn: async (): Promise<UsuarioFila[]> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, rol, activo')
        .order('nombre');
      if (error) throw error;
      return (data ?? []) as UsuarioFila[];
    },
  });
}

function usePermisos(usuarioId: string | null) {
  return useQuery({
    queryKey: ['admin', 'usuario_modulos', usuarioId],
    enabled: !!usuarioId,
    queryFn: async (): Promise<Partial<Record<Modulo, Permiso>>> => {
      const { data, error } = await supabase
        .from('usuario_modulos')
        .select('modulo, permiso')
        .eq('usuario_id', usuarioId as string);
      if (error) throw error;
      const mapa: Partial<Record<Modulo, Permiso>> = {};
      for (const m of data ?? []) mapa[m.modulo as Modulo] = m.permiso as Permiso;
      return mapa;
    },
  });
}

export function UsuariosCatalog({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const usuarios = useUsuarios();
  const [elegido, setElegido] = useState<string | null>(null);
  const permisos = usePermisos(elegido);

  const usuario = useMemo(
    () => (usuarios.data ?? []).find((u) => u.id === elegido) ?? null,
    [usuarios.data, elegido],
  );

  const guardar = useMutation({
    mutationFn: async (v: { modulo: Modulo; permiso: Permiso | null }) => {
      if (!elegido) return;
      if (v.permiso === null) {
        const { error } = await supabase
          .from('usuario_modulos')
          .delete()
          .eq('usuario_id', elegido)
          .eq('modulo', v.modulo);
        if (error) throw error;
        return;
      }
      // Sin `upsert` con onConflict para no depender del nombre del índice:
      // se borra y se inserta, que sobre una fila es igual de barato.
      const del = await supabase
        .from('usuario_modulos').delete().eq('usuario_id', elegido).eq('modulo', v.modulo);
      if (del.error) throw del.error;
      const { error } = await supabase
        .from('usuario_modulos')
        .insert({ usuario_id: elegido, modulo: v.modulo, permiso: v.permiso });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'usuario_modulos', elegido] });
    },
    onError: (err) => toast.error(describeError(err)),
  });

  const cambiarRol = useMutation({
    mutationFn: async (rol: AppRol) => {
      if (!elegido) return;
      const { error } = await supabase.from('usuarios').update({ rol }).eq('id', elegido);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
      toast.success('Rol actualizado.');
    },
    onError: (err) => toast.error(describeError(err)),
  });

  const grupos = useMemo(
    () => [...new Set(MODULOS.map((m) => m.grupo))],
    [],
  );

  return (
    <section className="space-y-4">
      <div className="rounded-card border border-sand bg-white p-4 shadow-sm">
        <h2 className="font-heading text-base font-extrabold text-dark">Usuarios y accesos</h2>
        <p className="mt-1 text-xs text-dark-2">
          La cuenta de acceso se crea en el panel de Supabase (Authentication → Add user).
          Al crearla aparece aquí sin ningún módulo, o sea sin ver nada, hasta que se le asigne
          uno. Lo que marques aquí es lo que manda: la base lo aplica, no solo el menú.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-card border border-sand bg-white p-2 shadow-sm">
          {usuarios.isLoading && <p className="p-2 text-xs text-dark-3">Cargando…</p>}
          {usuarios.isError && (
            <p className="p-2 text-xs text-rust">{describeError(usuarios.error)}</p>
          )}
          <ul className="space-y-1">
            {(usuarios.data ?? []).map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setElegido(u.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    elegido === u.id ? 'bg-teal-l font-extrabold text-teal-d' : 'hover:bg-sand-l'
                  }`}
                >
                  <div className="truncate">{u.nombre ?? '(sin nombre)'}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">
                    {u.rol}
                    {!u.activo && ' · inactivo'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="rounded-card border border-sand bg-white p-4 shadow-sm">
          {!usuario ? (
            <p className="text-sm italic text-dark-3">
              Escoge un usuario de la lista para ver y cambiar sus accesos.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-heading text-lg font-extrabold text-dark">
                    {usuario.nombre ?? '(sin nombre)'}
                  </div>
                  <div className="text-xs text-dark-3">{usuario.id}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
                    Rol base
                  </label>
                  <select
                    value={usuario.rol}
                    disabled={!canEdit}
                    onChange={(e) => cambiarRol.mutate(e.target.value as AppRol)}
                    className="mt-1 rounded-md border border-sand bg-white px-3 py-2 text-sm disabled:opacity-60"
                  >
                    <option value="solo_lectura">solo_lectura</option>
                    <option value="board_member">board_member</option>
                    <option value="asistente">asistente</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              </div>

              {usuario.rol === 'admin' && (
                <div className="rounded-md border border-gold bg-gold-light/50 px-3 py-2 text-xs text-dark-2">
                  Un <b>admin</b> pasa por encima de estos permisos: puede todo en todos los
                  módulos. Las casillas de abajo no le aplican.
                </div>
              )}

              {permisos.isLoading && <p className="text-xs text-dark-3">Cargando accesos…</p>}

              {grupos.map((grupo) => (
                <div key={grupo}>
                  <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-dark-3">
                    {grupo}
                  </div>
                  <div className="space-y-1">
                    {MODULOS.filter((m) => m.grupo === grupo).map((m) => {
                      const actual = permisos.data?.[m.key] ?? null;
                      return (
                        <div
                          key={m.key}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sand px-3 py-2"
                        >
                          <span className="text-sm text-dark">{m.label}</span>
                          <div className="flex gap-1">
                            <Nivel
                              activo={actual === null}
                              onClick={() => guardar.mutate({ modulo: m.key, permiso: null })}
                              disabled={!canEdit || guardar.isPending}
                              label="Sin acceso"
                              pie="No lo ve"
                              apagado
                            />
                            {NIVELES.map((n) => (
                              <Nivel
                                key={n.key}
                                activo={actual === n.key}
                                onClick={() => guardar.mutate({ modulo: m.key, permiso: n.key })}
                                disabled={!canEdit || guardar.isPending}
                                label={n.label}
                                pie={n.pie}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Nivel({
  activo, onClick, disabled, label, pie, apagado,
}: {
  activo: boolean;
  onClick: () => void;
  disabled: boolean;
  label: string;
  pie: string;
  apagado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={pie}
      className={[
        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50',
        activo
          ? apagado
            ? 'bg-sand text-dark-2'
            : 'bg-teal text-white'
          : 'border border-sand text-dark-3 hover:bg-sand-l',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
