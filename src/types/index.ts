import type { Database } from './database';

export type ModuleKey =
  | 'dashboard'
  | 'maa'
  | 'ja'
  | 'la'
  | 'jm'
  | 'aa'
  | 'eg'
  | 'pe'
  | 'cc-board'
  | 'arriaza'
  | 'cea'
  | 'admin'
  | 'miel-sj';

export type AppRol = Database['public']['Enums']['app_rol'];

/** Los módulos a los que se le puede dar acceso a alguien. */
export type Modulo =
  | 'dashboard' | 'tt' | 'cea' | 'finanzas' | 'caja_chica' | 'miel_sj' | 'admin'
  | 'maa' | 'ja' | 'la' | 'jm' | 'aa' | 'eg' | 'pe';

/** Observador ve; editor además crea y edita; super además borra. */
export type Permiso = 'observador' | 'editor' | 'super';

export const RANGO_PERMISO: Record<Permiso, number> = {
  observador: 1,
  editor: 2,
  super: 3,
};

export type UserProfile = {
  id: string;
  nombre: string | null;
  rol: AppRol;
  miembro_id: string | null;
  miembro_codigo: string | null;
  activo: boolean;
  /**
   * Nivel por módulo. Espejo de `usuario_modulos`, que es lo que de verdad
   * manda: esto solo sirve para armar el menú. Un admin lo tiene vacío
   * porque pasa todos los filtros por su rol.
   */
  modulos: Partial<Record<Modulo, Permiso>>;
};
