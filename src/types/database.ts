// Database types — Fases 4 + 5.
//
// Este archivo se debe regenerar desde Supabase cuando el esquema cambie:
//
//   npx supabase gen types typescript \
//     --project-id <project-ref> \
//     --schema public > src/types/database.ts
//
// Mientras no esté instalada la Supabase CLI, esta versión cubre a mano las
// tablas tocadas hasta la Fase 5 (entidades, usuarios, miembros_board,
// proveedores, autorizadores, empleados, tipos_pago, tarjetas_credito).
// Para Fase 6+ regenerar completo.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AuditCols = {
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type AuditInsert = {
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

type AuditUpdate = {
  updated_at?: string;
  updated_by?: string | null;
};

export type Database = {
  public: {
    Tables: {
      entidades: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          nombre: string;
          nit: string | null;
          direccion: string | null;
          contacto: string | null;
          telefono: string | null;
          email: string | null;
          notas: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          nombre: string;
          nit?: string | null;
          direccion?: string | null;
          contacto?: string | null;
          telefono?: string | null;
          email?: string | null;
          notas?: string | null;
        };
        Update: AuditUpdate & {
          nombre?: string;
          nit?: string | null;
          direccion?: string | null;
          contacto?: string | null;
          telefono?: string | null;
          email?: string | null;
          notas?: string | null;
        };
        Relationships: [];
      };

      autorizadores: {
        Row: {
          id: string;
          legacy_id: number | null;
          nombre: string;
          cargo: string | null;
          empresa: string | null;
          nit: string | null;
          dir: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          nombre: string;
          cargo?: string | null;
          empresa?: string | null;
          nit?: string | null;
          dir?: string | null;
          activo?: boolean;
        };
        Update: {
          nombre?: string;
          cargo?: string | null;
          empresa?: string | null;
          nit?: string | null;
          dir?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };

      empleados: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          nombre: string;
          puesto: string | null;
          depto: string | null;
          empresa: string | null;
          email: string | null;
          telefono: string | null;
          notas: string | null;
          activo: boolean;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          nombre: string;
          puesto?: string | null;
          depto?: string | null;
          empresa?: string | null;
          email?: string | null;
          telefono?: string | null;
          notas?: string | null;
          activo?: boolean;
        };
        Update: AuditUpdate & {
          nombre?: string;
          puesto?: string | null;
          depto?: string | null;
          empresa?: string | null;
          email?: string | null;
          telefono?: string | null;
          notas?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };

      tipos_pago: {
        Row: {
          id: string;
          legacy_id: number | null;
          tipo: string;
          descripcion: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          tipo: string;
          descripcion?: string | null;
          activo?: boolean;
        };
        Update: {
          tipo?: string;
          descripcion?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };

      proveedores: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          origen: string | null;
          nombre: string;
          razon: string | null;
          nit: string | null;
          giro: string | null;
          tel: string | null;
          email: string | null;
          contacto: string | null;
          celcontacto: string | null;
          direccion: string | null;
          notas: string | null;
          activo: boolean;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          origen?: string | null;
          nombre: string;
          razon?: string | null;
          nit?: string | null;
          giro?: string | null;
          tel?: string | null;
          email?: string | null;
          contacto?: string | null;
          celcontacto?: string | null;
          direccion?: string | null;
          notas?: string | null;
          activo?: boolean;
        };
        Update: AuditUpdate & {
          nombre?: string;
          razon?: string | null;
          nit?: string | null;
          giro?: string | null;
          tel?: string | null;
          email?: string | null;
          contacto?: string | null;
          celcontacto?: string | null;
          direccion?: string | null;
          notas?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };

      tarjetas_credito: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          tipo: Database['public']['Enums']['tc_tipo'];
          tc_id: string;
          empresa: string | null;
          titular: string | null;
          red: string | null;
          banco: string | null;
          nit: string | null;
          limite: string | null;
          direccion: string | null;
          notas: string | null;
          activo: boolean;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          tipo: Database['public']['Enums']['tc_tipo'];
          tc_id: string;
          empresa?: string | null;
          titular?: string | null;
          red?: string | null;
          banco?: string | null;
          nit?: string | null;
          limite?: string | null;
          direccion?: string | null;
          notas?: string | null;
          activo?: boolean;
        };
        Update: AuditUpdate & {
          tipo?: Database['public']['Enums']['tc_tipo'];
          tc_id?: string;
          empresa?: string | null;
          titular?: string | null;
          red?: string | null;
          banco?: string | null;
          nit?: string | null;
          limite?: string | null;
          direccion?: string | null;
          notas?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };

      miembros_board: {
        Row: AuditCols & {
          id: string;
          codigo: string;
          nombre: string;
          rol: string | null;
          color: string | null;
          orden: number | null;
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
      tc_tipo: 'corporativa' | 'presidencia';
    };
    CompositeTypes: Record<string, never>;
  };
};
