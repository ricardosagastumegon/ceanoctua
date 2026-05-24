// Database types — Fases 4-6.
//
// Regenerar desde Supabase cuando el esquema cambie:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts

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
type AuditUpdate = { updated_at?: string; updated_by?: string | null };

export type Database = {
  public: {
    Tables: {
      // ====================================================
      // Catalogos (Fases 4-5)
      // ====================================================
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
        Insert: { id?: string; legacy_id?: number | null; nombre: string; cargo?: string | null; empresa?: string | null; nit?: string | null; dir?: string | null; activo?: boolean };
        Update: { nombre?: string; cargo?: string | null; empresa?: string | null; nit?: string | null; dir?: string | null; activo?: boolean };
        Relationships: [];
      };
      empleados: {
        Row: AuditCols & { id: string; legacy_id: number | null; nombre: string; puesto: string | null; depto: string | null; empresa: string | null; email: string | null; telefono: string | null; notas: string | null; activo: boolean };
        Insert: AuditInsert & { id?: string; legacy_id?: number | null; nombre: string; puesto?: string | null; depto?: string | null; empresa?: string | null; email?: string | null; telefono?: string | null; notas?: string | null; activo?: boolean };
        Update: AuditUpdate & { nombre?: string; puesto?: string | null; depto?: string | null; empresa?: string | null; email?: string | null; telefono?: string | null; notas?: string | null; activo?: boolean };
        Relationships: [];
      };
      tipos_pago: {
        Row: { id: string; legacy_id: number | null; tipo: string; descripcion: string | null; activo: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; legacy_id?: number | null; tipo: string; descripcion?: string | null; activo?: boolean };
        Update: { tipo?: string; descripcion?: string | null; activo?: boolean };
        Relationships: [];
      };
      proveedores: {
        Row: AuditCols & { id: string; legacy_id: number | null; origen: string | null; nombre: string; razon: string | null; nit: string | null; giro: string | null; tel: string | null; email: string | null; contacto: string | null; celcontacto: string | null; direccion: string | null; notas: string | null; activo: boolean };
        Insert: AuditInsert & { id?: string; legacy_id?: number | null; origen?: string | null; nombre: string; razon?: string | null; nit?: string | null; giro?: string | null; tel?: string | null; email?: string | null; contacto?: string | null; celcontacto?: string | null; direccion?: string | null; notas?: string | null; activo?: boolean };
        Update: AuditUpdate & { nombre?: string; razon?: string | null; nit?: string | null; giro?: string | null; tel?: string | null; email?: string | null; contacto?: string | null; celcontacto?: string | null; direccion?: string | null; notas?: string | null; activo?: boolean };
        Relationships: [];
      };
      tarjetas_credito: {
        Row: AuditCols & { id: string; legacy_id: number | null; tipo: Database['public']['Enums']['tc_tipo']; tc_id: string; empresa: string | null; titular: string | null; red: string | null; banco: string | null; nit: string | null; limite: string | null; direccion: string | null; notas: string | null; activo: boolean };
        Insert: AuditInsert & { id?: string; legacy_id?: number | null; tipo: Database['public']['Enums']['tc_tipo']; tc_id: string; empresa?: string | null; titular?: string | null; red?: string | null; banco?: string | null; nit?: string | null; limite?: string | null; direccion?: string | null; notas?: string | null; activo?: boolean };
        Update: AuditUpdate & { tipo?: Database['public']['Enums']['tc_tipo']; tc_id?: string; empresa?: string | null; titular?: string | null; red?: string | null; banco?: string | null; nit?: string | null; limite?: string | null; direccion?: string | null; notas?: string | null; activo?: boolean };
        Relationships: [];
      };

      // ====================================================
      // Identity
      // ====================================================
      miembros_board: {
        Row: AuditCols & { id: string; codigo: string; nombre: string; rol: string | null; color: string | null; orden: number | null };
        Insert: { id?: string; codigo: string; nombre: string; rol?: string | null; color?: string | null; orden?: number | null };
        Update: { codigo?: string; nombre?: string; rol?: string | null; color?: string | null; orden?: number | null };
        Relationships: [];
      };
      usuarios: {
        Row: { id: string; nombre: string | null; rol: Database['public']['Enums']['app_rol']; miembro_id: string | null; activo: boolean; created_at: string; updated_at: string };
        Insert: { id: string; nombre?: string | null; rol?: Database['public']['Enums']['app_rol']; miembro_id?: string | null; activo?: boolean };
        Update: { nombre?: string | null; rol?: Database['public']['Enums']['app_rol']; miembro_id?: string | null; activo?: boolean };
        Relationships: [
          { foreignKeyName: 'usuarios_miembro_id_fkey'; columns: ['miembro_id']; referencedRelation: 'miembros_board'; referencedColumns: ['id'] },
        ];
      };

      // ====================================================
      // Board members (Fase 6)
      // ====================================================
      tareas: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          miembro_id: string | null;
          lista: string | null;
          texto: string;
          fecha: string | null;
          prioridad: Database['public']['Enums']['task_priority'] | null;
          estado: Database['public']['Enums']['task_status'];
          notas: string | null;
          done: boolean;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          miembro_id?: string | null;
          lista?: string | null;
          texto: string;
          fecha?: string | null;
          prioridad?: Database['public']['Enums']['task_priority'] | null;
          estado?: Database['public']['Enums']['task_status'];
          notas?: string | null;
          done?: boolean;
        };
        Update: AuditUpdate & {
          miembro_id?: string | null;
          lista?: string | null;
          texto?: string;
          fecha?: string | null;
          prioridad?: Database['public']['Enums']['task_priority'] | null;
          estado?: Database['public']['Enums']['task_status'];
          notas?: string | null;
          done?: boolean;
        };
        Relationships: [
          { foreignKeyName: 'tareas_miembro_id_fkey'; columns: ['miembro_id']; referencedRelation: 'miembros_board'; referencedColumns: ['id'] },
        ];
      };
      viajes: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          miembro_id: string | null;
          destino: string;
          fecha_ini: string | null;
          fecha_fin: string | null;
          tipo: Database['public']['Enums']['trip_type'] | null;
          estado: Database['public']['Enums']['trip_status'];
          notas: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          miembro_id?: string | null;
          destino: string;
          fecha_ini?: string | null;
          fecha_fin?: string | null;
          tipo?: Database['public']['Enums']['trip_type'] | null;
          estado?: Database['public']['Enums']['trip_status'];
          notas?: string | null;
        };
        Update: AuditUpdate & {
          miembro_id?: string | null;
          destino?: string;
          fecha_ini?: string | null;
          fecha_fin?: string | null;
          tipo?: Database['public']['Enums']['trip_type'] | null;
          estado?: Database['public']['Enums']['trip_status'];
          notas?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'viajes_miembro_id_fkey'; columns: ['miembro_id']; referencedRelation: 'miembros_board'; referencedColumns: ['id'] },
        ];
      };
      viaje_checklist: {
        Row: {
          id: string;
          legacy_id: number | null;
          viaje_id: string;
          item: string;
          done: boolean;
          orden: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          viaje_id: string;
          item: string;
          done?: boolean;
          orden?: number | null;
        };
        Update: { item?: string; done?: boolean; orden?: number | null };
        Relationships: [
          { foreignKeyName: 'viaje_checklist_viaje_id_fkey'; columns: ['viaje_id']; referencedRelation: 'viajes'; referencedColumns: ['id'] },
        ];
      };
      perfiles: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          miembro_id: string | null;
          bday: string | null;
          phone: string | null;
          telco: string | null;
          email: string | null;
          address: string | null;
          nit: string | null;
          dpi: string | null;
          pilot_name: string | null;
          pilot_phone: string | null;
          notas: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          miembro_id?: string | null;
          bday?: string | null;
          phone?: string | null;
          telco?: string | null;
          email?: string | null;
          address?: string | null;
          nit?: string | null;
          dpi?: string | null;
          pilot_name?: string | null;
          pilot_phone?: string | null;
          notas?: string | null;
        };
        Update: AuditUpdate & {
          miembro_id?: string | null;
          bday?: string | null;
          phone?: string | null;
          telco?: string | null;
          email?: string | null;
          address?: string | null;
          nit?: string | null;
          dpi?: string | null;
          pilot_name?: string | null;
          pilot_phone?: string | null;
          notas?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'perfiles_miembro_id_fkey'; columns: ['miembro_id']; referencedRelation: 'miembros_board'; referencedColumns: ['id'] },
        ];
      };
      perfil_vehiculos: {
        Row: { id: string; legacy_id: number | null; perfil_id: string; modelo: string | null; placa: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; legacy_id?: number | null; perfil_id: string; modelo?: string | null; placa?: string | null };
        Update: { modelo?: string | null; placa?: string | null };
        Relationships: [{ foreignKeyName: 'perfil_vehiculos_perfil_id_fkey'; columns: ['perfil_id']; referencedRelation: 'perfiles'; referencedColumns: ['id'] }];
      };
      perfil_familia: {
        Row: { id: string; legacy_id: number | null; perfil_id: string; nombre: string; relacion: string | null; fecha_nac: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; legacy_id?: number | null; perfil_id: string; nombre: string; relacion?: string | null; fecha_nac?: string | null };
        Update: { nombre?: string; relacion?: string | null; fecha_nac?: string | null };
        Relationships: [{ foreignKeyName: 'perfil_familia_perfil_id_fkey'; columns: ['perfil_id']; referencedRelation: 'perfiles'; referencedColumns: ['id'] }];
      };
      perfil_fechas: {
        Row: { id: string; legacy_id: number | null; perfil_id: string; titulo: string; fecha: string; created_at: string; updated_at: string };
        Insert: { id?: string; legacy_id?: number | null; perfil_id: string; titulo: string; fecha: string };
        Update: { titulo?: string; fecha?: string };
        Relationships: [{ foreignKeyName: 'perfil_fechas_perfil_id_fkey'; columns: ['perfil_id']; referencedRelation: 'perfiles'; referencedColumns: ['id'] }];
      };
      eventos: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          origen: string | null;
          miembro_id: string | null;
          titulo: string;
          tipo: Database['public']['Enums']['evento_tipo'] | null;
          fecha: string | null;
          lugar: string | null;
          descripcion: string | null;
          notas: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          origen?: string | null;
          miembro_id?: string | null;
          titulo: string;
          tipo?: Database['public']['Enums']['evento_tipo'] | null;
          fecha?: string | null;
          lugar?: string | null;
          descripcion?: string | null;
          notas?: string | null;
        };
        Update: AuditUpdate & {
          origen?: string | null;
          miembro_id?: string | null;
          titulo?: string;
          tipo?: Database['public']['Enums']['evento_tipo'] | null;
          fecha?: string | null;
          lugar?: string | null;
          descripcion?: string | null;
          notas?: string | null;
        };
        Relationships: [{ foreignKeyName: 'eventos_miembro_id_fkey'; columns: ['miembro_id']; referencedRelation: 'miembros_board'; referencedColumns: ['id'] }];
      };
      notas: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          origen: string | null;
          miembro_id: string | null;
          titulo: string | null;
          contenido: string;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          origen?: string | null;
          miembro_id?: string | null;
          titulo?: string | null;
          contenido: string;
        };
        Update: AuditUpdate & {
          origen?: string | null;
          miembro_id?: string | null;
          titulo?: string | null;
          contenido?: string;
        };
        Relationships: [{ foreignKeyName: 'notas_miembro_id_fkey'; columns: ['miembro_id']; referencedRelation: 'miembros_board'; referencedColumns: ['id'] }];
      };

      // ====================================================
      // Documentos (storage metadata)
      // ====================================================
      documentos: {
        Row: {
          id: string;
          legacy_id: number | null;
          nombre: string;
          tipo_mime: string | null;
          tamano_bytes: number | null;
          storage_path: string;
          entidad_tipo: string | null;
          entidad_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          nombre: string;
          tipo_mime?: string | null;
          tamano_bytes?: number | null;
          storage_path: string;
          entidad_tipo?: string | null;
          entidad_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          nombre?: string;
          tipo_mime?: string | null;
          tamano_bytes?: number | null;
          storage_path?: string;
          entidad_tipo?: string | null;
          entidad_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_rol: 'admin' | 'asistente' | 'board_member' | 'solo_lectura';
      currency: 'USD' | 'GTQ' | 'EUR' | 'GBP';
      tc_tipo: 'corporativa' | 'presidencia';
      task_priority: 'baja' | 'media' | 'alta';
      task_status: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
      trip_type: 'personal' | 'trabajo' | 'familia' | 'salud' | 'otro';
      trip_status: 'planificado' | 'en_curso' | 'completado' | 'cancelado';
      evento_tipo: 'reunion' | 'cumpleanos' | 'aniversario' | 'viaje' | 'religioso' | 'otro';
    };
    CompositeTypes: Record<string, never>;
  };
};
