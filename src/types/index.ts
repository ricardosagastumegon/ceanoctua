import type { Database } from './database';

export type ModuleKey =
  | 'dashboard'
  | 'cc-board'
  | 'arriaza'
  | 'cea'
  | 'admin'
  | 'miel-sj';

export type AppRol = Database['public']['Enums']['app_rol'];

/** Los módulos a los que se le puede dar acceso a alguien. */
export type Modulo =
  | 'dashboard' | 'tt' | 'aeronaves' | 'cea' | 'finanzas' | 'caja_chica'
  | 'miel_sj' | 'admin' | 'combustible' | 'tesoreria'
  // La llave del piloto: entra SOLO a su liquidación de viaje, no al resto
  // de Aeronaves (flota, certificados, estado de cuenta, combustible).
  | 'avn_liquidacion';

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
  /**
   * Qué persona de Personal JD es. De aquí sale qué to-dos son suyos: la
   * cuenta con la que se entra y la persona a la que se le asigna trabajo
   * son dos cosas distintas.
   */
  persona_id: string | null;
  /** Marcado como firmante en Personal JD. Es lo que habilita firmar. */
  es_firmante: boolean;
  activo: boolean;
  /**
   * Nivel por módulo. Espejo de `usuario_modulos`, que es lo que de verdad
   * manda: esto solo sirve para armar el menú. Un admin lo tiene vacío
   * porque pasa todos los filtros por su rol.
   */
  modulos: Partial<Record<Modulo, Permiso>>;
};
