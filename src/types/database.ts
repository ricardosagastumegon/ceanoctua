// Database types — Fase 4.
//
// Este archivo se debe regenerar desde Supabase cuando el esquema cambie:
//
//   npx supabase gen types typescript \
//     --project-id <project-ref> \
//     --schema public > src/types/database.ts
//
// Mientras no esté instalada la Supabase CLI ni configurado el access token,
// esta versión cubre a mano sólo las tablas que toca la Fase 4
// (entidades, usuarios, miembros_board). Para Fase 5+ regenerar completo.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      entidades: {
        Row: {
          id: string;
          legacy_id: number | null;
          nombre: string;
          nit: string | null;
          direccion: string | null;
          contacto: string | null;
          telefono: string | null;
          email: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          nombre: string;
          nit?: string | null;
          direccion?: string | null;
          contacto?: string | null;
          telefono?: string | null;
          email?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          legacy_id?: number | null;
          nombre?: string;
          nit?: string | null;
          direccion?: string | null;
          contacto?: string | null;
          telefono?: string | null;
          email?: string | null;
          notas?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      miembros_board: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          rol: string | null;
          color: string | null;
          orden: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          rol?: string | null;
          color?: string | null;
          orden?: number | null;
        };
        Update: {
          codigo?: string;
          nombre?: string;
          rol?: string | null;
          color?: string | null;
          orden?: number | null;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          nombre: string | null;
          rol: Database['public']['Enums']['app_rol'];
          miembro_id: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nombre?: string | null;
          rol?: Database['public']['Enums']['app_rol'];
          miembro_id?: string | null;
          activo?: boolean;
        };
        Update: {
          nombre?: string | null;
          rol?: Database['public']['Enums']['app_rol'];
          miembro_id?: string | null;
          activo?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'usuarios_miembro_id_fkey';
            columns: ['miembro_id'];
            referencedRelation: 'miembros_board';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_rol: 'admin' | 'asistente' | 'board_member' | 'solo_lectura';
      currency: 'USD' | 'GTQ' | 'EUR' | 'GBP';
    };
    CompositeTypes: Record<string, never>;
  };
};
