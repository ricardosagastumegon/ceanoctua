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

export type UserProfile = {
  id: string;
  nombre: string | null;
  rol: AppRol;
  miembro_id: string | null;
  miembro_codigo: string | null;
  activo: boolean;
};
