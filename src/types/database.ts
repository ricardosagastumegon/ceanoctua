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
      // CEA module (Fase 7)
      // ====================================================
      cea_todos: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          asunto: string;
          responsable: string | null;
          empleado_id: string | null;
          fecha: string | null;
          prioridad: Database['public']['Enums']['task_priority'] | null;
          estado: Database['public']['Enums']['task_status'];
          done: boolean;
          notas: string | null;
          prioridad_label: string | null;
          estado_label: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          asunto: string;
          responsable?: string | null;
          empleado_id?: string | null;
          fecha?: string | null;
          prioridad?: Database['public']['Enums']['task_priority'] | null;
          estado?: Database['public']['Enums']['task_status'];
          done?: boolean;
          notas?: string | null;
          prioridad_label?: string | null;
          estado_label?: string | null;
        };
        Update: AuditUpdate & {
          asunto?: string;
          responsable?: string | null;
          empleado_id?: string | null;
          fecha?: string | null;
          prioridad?: Database['public']['Enums']['task_priority'] | null;
          estado?: Database['public']['Enums']['task_status'];
          done?: boolean;
          notas?: string | null;
          prioridad_label?: string | null;
          estado_label?: string | null;
        };
        Relationships: [];
      };

      lavanderia: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          asunto: string | null;
          solicitado: string | null;
          descripcion: string | null;
          notas: string | null;
          step_idx: number;
          step_dates: string[];
          deleted_at: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          asunto?: string | null;
          solicitado?: string | null;
          descripcion?: string | null;
          notas?: string | null;
          step_idx?: number;
          step_dates?: string[];
          deleted_at?: string | null;
        };
        Update: AuditUpdate & {
          asunto?: string | null;
          solicitado?: string | null;
          descripcion?: string | null;
          notas?: string | null;
          step_idx?: number;
          step_dates?: string[];
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      directorio: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          nombre: string;
          tipo: string | null;
          razon: string | null;
          nit: string | null;
          giro: string | null;
          tel: string | null;
          whatsapp: string | null;
          email: string | null;
          web: string | null;
          direccion: string | null;
          notas: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          nombre: string;
          tipo?: string | null;
          razon?: string | null;
          nit?: string | null;
          giro?: string | null;
          tel?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          web?: string | null;
          direccion?: string | null;
          notas?: string | null;
        };
        Update: AuditUpdate & {
          nombre?: string;
          tipo?: string | null;
          razon?: string | null;
          nit?: string | null;
          giro?: string | null;
          tel?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          web?: string | null;
          direccion?: string | null;
          notas?: string | null;
        };
        Relationships: [];
      };

      firmas: {
        Row: {
          id: string;
          legacy_id: number | null;
          serial: string | null;
          recepcion: string | null;
          tipo: string;
          urgencia: Database['public']['Enums']['firma_urgencia'] | null;
          justificacion: string | null;
          entregado: string | null;
          solicitado: string | null;
          status_firma: Database['public']['Enums']['firma_status'];
          fecha_firma: string | null;
          fecha_entrega: string | null;
          quien_recibe: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          serial?: string | null;
          recepcion?: string | null;
          tipo: string;
          urgencia?: Database['public']['Enums']['firma_urgencia'] | null;
          justificacion?: string | null;
          entregado?: string | null;
          solicitado?: string | null;
          status_firma?: Database['public']['Enums']['firma_status'];
          fecha_firma?: string | null;
          fecha_entrega?: string | null;
          quien_recibe?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          recepcion?: string | null;
          tipo?: string;
          urgencia?: Database['public']['Enums']['firma_urgencia'] | null;
          justificacion?: string | null;
          entregado?: string | null;
          solicitado?: string | null;
          status_firma?: Database['public']['Enums']['firma_status'];
          fecha_firma?: string | null;
          fecha_entrega?: string | null;
          quien_recibe?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      // ====================================================
      // Miel SJ (Fase 8)
      // ====================================================
      miel_constancias: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          correlativo: string | null;
          fecha: string;
          nombre: string;
          direccion: string | null;
          cant475: number;
          precio475: number;
          cant1000: number;
          precio1000: number;
          envio: boolean;
          envio_dir: string | null;
          envio_costo: number;
          total: number;
          moneda: Database['public']['Enums']['currency'];
          notas: string | null;
          entregado: string | null;
          recibido: string | null;
          deleted_at: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          correlativo?: string | null;
          fecha: string;
          nombre: string;
          direccion?: string | null;
          cant475?: number;
          precio475?: number;
          cant1000?: number;
          precio1000?: number;
          envio?: boolean;
          envio_dir?: string | null;
          envio_costo?: number;
          total?: number;
          moneda?: Database['public']['Enums']['currency'];
          notas?: string | null;
          entregado?: string | null;
          recibido?: string | null;
          deleted_at?: string | null;
        };
        Update: AuditUpdate & {
          fecha?: string;
          nombre?: string;
          direccion?: string | null;
          cant475?: number;
          precio475?: number;
          cant1000?: number;
          precio1000?: number;
          envio?: boolean;
          envio_dir?: string | null;
          envio_costo?: number;
          total?: number;
          moneda?: Database['public']['Enums']['currency'];
          notas?: string | null;
          entregado?: string | null;
          recibido?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      // ====================================================
      // Arriaza T&T (Fase 8)
      // ====================================================
      att_viajes: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          miembro_id: string | null;
          titulo: string;
          destino: string | null;
          pais: string | null;
          ciudad: string | null;
          fecha_ini: string | null;
          fecha_fin: string | null;
          estado: Database['public']['Enums']['trip_status'];
          proposito: string | null;
          other_reason: string | null;
          paidby: string | null;
          acompanantes: string | null;
          notas: string | null;
          lat: number | null;
          lng: number | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          miembro_id?: string | null;
          titulo: string;
          destino?: string | null;
          pais?: string | null;
          ciudad?: string | null;
          fecha_ini?: string | null;
          fecha_fin?: string | null;
          estado?: Database['public']['Enums']['trip_status'];
          proposito?: string | null;
          other_reason?: string | null;
          paidby?: string | null;
          acompanantes?: string | null;
          notas?: string | null;
          lat?: number | null;
          lng?: number | null;
        };
        Update: AuditUpdate & {
          miembro_id?: string | null;
          titulo?: string;
          destino?: string | null;
          pais?: string | null;
          ciudad?: string | null;
          fecha_ini?: string | null;
          fecha_fin?: string | null;
          estado?: Database['public']['Enums']['trip_status'];
          proposito?: string | null;
          other_reason?: string | null;
          paidby?: string | null;
          acompanantes?: string | null;
          notas?: string | null;
          lat?: number | null;
          lng?: number | null;
        };
        Relationships: [];
      };
      att_tickets: {
        Row: {
          id: string;
          legacy_id: number | null;
          viaje_id: string;
          aerolinea: string | null;
          codigo_reserva: string | null;
          numero_ticket: string | null;
          numero_vuelo: string | null;
          tipo_vuelo: string | null;
          origen: string | null;
          destino: string | null;
          fecha_salida: string | null;
          fecha_llegada: string | null;
          asiento: string | null;
          clase: string | null;
          monto: number | null;
          moneda: Database['public']['Enums']['currency'] | null;
          notas: string | null;
          comentarios: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          viaje_id: string;
          aerolinea?: string | null;
          codigo_reserva?: string | null;
          numero_ticket?: string | null;
          numero_vuelo?: string | null;
          tipo_vuelo?: string | null;
          origen?: string | null;
          destino?: string | null;
          fecha_salida?: string | null;
          fecha_llegada?: string | null;
          asiento?: string | null;
          clase?: string | null;
          monto?: number | null;
          moneda?: Database['public']['Enums']['currency'] | null;
          notas?: string | null;
          comentarios?: string | null;
        };
        Update: {
          aerolinea?: string | null;
          codigo_reserva?: string | null;
          numero_ticket?: string | null;
          numero_vuelo?: string | null;
          tipo_vuelo?: string | null;
          origen?: string | null;
          destino?: string | null;
          fecha_salida?: string | null;
          fecha_llegada?: string | null;
          asiento?: string | null;
          clase?: string | null;
          monto?: number | null;
          moneda?: Database['public']['Enums']['currency'] | null;
          notas?: string | null;
          comentarios?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'att_tickets_viaje_id_fkey'; columns: ['viaje_id']; referencedRelation: 'att_viajes'; referencedColumns: ['id'] },
        ];
      };
      att_hoteles: {
        Row: {
          id: string;
          legacy_id: number | null;
          viaje_id: string;
          nombre: string;
          location: string | null;
          direccion: string | null;
          ciudad: string | null;
          pais: string | null;
          checkin: string | null;
          checkout: string | null;
          nights: number | null;
          confirmacion: string | null;
          room: string | null;
          rate: number | null;
          monto: number | null;
          moneda: Database['public']['Enums']['currency'] | null;
          ota: string | null;
          pay: string | null;
          services: string | null;
          cancel_policy: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          viaje_id: string;
          nombre: string;
          location?: string | null;
          direccion?: string | null;
          ciudad?: string | null;
          pais?: string | null;
          checkin?: string | null;
          checkout?: string | null;
          nights?: number | null;
          confirmacion?: string | null;
          room?: string | null;
          rate?: number | null;
          monto?: number | null;
          moneda?: Database['public']['Enums']['currency'] | null;
          ota?: string | null;
          pay?: string | null;
          services?: string | null;
          cancel_policy?: string | null;
          notas?: string | null;
        };
        Update: {
          nombre?: string;
          location?: string | null;
          direccion?: string | null;
          ciudad?: string | null;
          pais?: string | null;
          checkin?: string | null;
          checkout?: string | null;
          nights?: number | null;
          confirmacion?: string | null;
          room?: string | null;
          rate?: number | null;
          monto?: number | null;
          moneda?: Database['public']['Enums']['currency'] | null;
          ota?: string | null;
          pay?: string | null;
          services?: string | null;
          cancel_policy?: string | null;
          notas?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'att_hoteles_viaje_id_fkey'; columns: ['viaje_id']; referencedRelation: 'att_viajes'; referencedColumns: ['id'] },
        ];
      };
      att_restaurantes: {
        Row: {
          id: string;
          legacy_id: number | null;
          viaje_id: string;
          nombre: string;
          specialty: string | null;
          phone: string | null;
          email: string | null;
          location: string | null;
          ciudad: string | null;
          direccion: string | null;
          fecha: string | null;
          hora: string | null;
          covers: number | null;
          conf: string | null;
          monto: number | null;
          moneda: Database['public']['Enums']['currency'] | null;
          reserva: string | null;
          detalles: string | null;
          cancel_policy: string | null;
          stars: number | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          viaje_id: string;
          nombre: string;
          specialty?: string | null;
          phone?: string | null;
          email?: string | null;
          location?: string | null;
          ciudad?: string | null;
          direccion?: string | null;
          fecha?: string | null;
          hora?: string | null;
          covers?: number | null;
          conf?: string | null;
          monto?: number | null;
          moneda?: Database['public']['Enums']['currency'] | null;
          reserva?: string | null;
          detalles?: string | null;
          cancel_policy?: string | null;
          stars?: number | null;
          notas?: string | null;
        };
        Update: {
          nombre?: string;
          specialty?: string | null;
          phone?: string | null;
          email?: string | null;
          location?: string | null;
          ciudad?: string | null;
          direccion?: string | null;
          fecha?: string | null;
          hora?: string | null;
          covers?: number | null;
          conf?: string | null;
          monto?: number | null;
          moneda?: Database['public']['Enums']['currency'] | null;
          reserva?: string | null;
          detalles?: string | null;
          cancel_policy?: string | null;
          stars?: number | null;
          notas?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'att_restaurantes_viaje_id_fkey'; columns: ['viaje_id']; referencedRelation: 'att_viajes'; referencedColumns: ['id'] },
        ];
      };

      // ====================================================
      // Financial module (Fase 9)
      // ====================================================
      caja_chica_vales: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          serial: string | null;
          fecha: string | null;
          moneda: Database['public']['Enums']['currency'];
          monto: number;
          vale_a: string;
          empleado_id: string | null;
          entidad: string | null;
          entidad_id: string | null;
          concepto: string | null;
          lugar: string | null;
          estado: Database['public']['Enums']['vale_status'];
          notas: string | null;
          liquidacion_id: string | null;
          deleted_at: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          serial?: string | null;
          fecha?: string | null;
          moneda?: Database['public']['Enums']['currency'];
          monto: number;
          vale_a: string;
          empleado_id?: string | null;
          entidad?: string | null;
          entidad_id?: string | null;
          concepto?: string | null;
          lugar?: string | null;
          estado?: Database['public']['Enums']['vale_status'];
          notas?: string | null;
          liquidacion_id?: string | null;
          deleted_at?: string | null;
        };
        Update: AuditUpdate & {
          fecha?: string | null;
          moneda?: Database['public']['Enums']['currency'];
          monto?: number;
          vale_a?: string;
          empleado_id?: string | null;
          entidad?: string | null;
          entidad_id?: string | null;
          concepto?: string | null;
          lugar?: string | null;
          estado?: Database['public']['Enums']['vale_status'];
          notas?: string | null;
          liquidacion_id?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      caja_chica_liquidaciones: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          serial: string | null;
          fecha: string;
          periodo: string | null;
          moneda: Database['public']['Enums']['currency'];
          monto_total: number;
          responsable: string | null;
          empleado_id: string | null;
          notas: string | null;
          estado: string;
          entidad: string | null;
          payment_method: string | null;
          motivo: string | null;
          producto: string | null;
          solicitado: string | null;
          reintegrar_a: string | null;
          vale_serial: string | null;
          vale_monto: number;
          diff: number;
          comentarios: string | null;
          comprobante_storage_path: string | null;
          deleted_at: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          serial?: string | null;
          fecha: string;
          periodo?: string | null;
          moneda?: Database['public']['Enums']['currency'];
          monto_total?: number;
          responsable?: string | null;
          empleado_id?: string | null;
          notas?: string | null;
          estado?: string;
          entidad?: string | null;
          payment_method?: string | null;
          motivo?: string | null;
          producto?: string | null;
          solicitado?: string | null;
          reintegrar_a?: string | null;
          vale_serial?: string | null;
          vale_monto?: number;
          comentarios?: string | null;
          comprobante_storage_path?: string | null;
          deleted_at?: string | null;
        };
        Update: AuditUpdate & {
          fecha?: string;
          periodo?: string | null;
          moneda?: Database['public']['Enums']['currency'];
          monto_total?: number;
          responsable?: string | null;
          empleado_id?: string | null;
          notas?: string | null;
          estado?: string;
          entidad?: string | null;
          payment_method?: string | null;
          motivo?: string | null;
          producto?: string | null;
          solicitado?: string | null;
          reintegrar_a?: string | null;
          vale_serial?: string | null;
          vale_monto?: number;
          comentarios?: string | null;
          comprobante_storage_path?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      caja_chica_liq_rows: {
        Row: {
          id: string;
          legacy_id: number | null;
          liquidacion_id: string;
          fecha: string | null;
          factura: string | null;
          proveedor: string | null;
          concepto: string | null;
          cantidad: number;
          unitario: number;
          total: number;
          orden: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          liquidacion_id: string;
          fecha?: string | null;
          factura?: string | null;
          proveedor?: string | null;
          concepto?: string | null;
          cantidad?: number;
          unitario?: number;
          orden?: number | null;
        };
        Update: {
          fecha?: string | null;
          factura?: string | null;
          proveedor?: string | null;
          concepto?: string | null;
          cantidad?: number;
          unitario?: number;
          orden?: number | null;
        };
        Relationships: [
          { foreignKeyName: 'caja_chica_liq_rows_liquidacion_id_fkey'; columns: ['liquidacion_id']; referencedRelation: 'caja_chica_liquidaciones'; referencedColumns: ['id'] },
        ];
      };

      tc_consumos: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          origen: string | null;
          voucher_num: string | null;
          fecha: string;
          empresa: string | null;
          card_id: string;
          tarjeta_id: string | null;
          proveedor: string;
          proveedor_id: string | null;
          concepto: string;
          monto: number;
          moneda: Database['public']['Enums']['currency'];
          autorizo: string | null;
          autorizador_id: string | null;
          reintegro_id: string | null;
          deleted_at: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          origen?: string | null;
          voucher_num?: string | null;
          fecha: string;
          empresa?: string | null;
          card_id: string;
          tarjeta_id?: string | null;
          proveedor: string;
          proveedor_id?: string | null;
          concepto: string;
          monto: number;
          moneda: Database['public']['Enums']['currency'];
          autorizo?: string | null;
          autorizador_id?: string | null;
          reintegro_id?: string | null;
          deleted_at?: string | null;
        };
        Update: AuditUpdate & {
          origen?: string | null;
          fecha?: string;
          empresa?: string | null;
          card_id?: string;
          tarjeta_id?: string | null;
          proveedor?: string;
          proveedor_id?: string | null;
          concepto?: string;
          monto?: number;
          moneda?: Database['public']['Enums']['currency'];
          autorizo?: string | null;
          autorizador_id?: string | null;
          reintegro_id?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      reintegros: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          fecha: string;
          empresa: string;
          tc_empresa: string | null;
          card_id: string;
          consumo_id: string | null;
          monto: number;
          moneda: Database['public']['Enums']['currency'];
          autorizo: string | null;
          autorizador_id: string | null;
          notas: string | null;
          estado: Database['public']['Enums']['reintegro_status'];
          deleted_at: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          fecha: string;
          empresa: string;
          tc_empresa?: string | null;
          card_id: string;
          consumo_id?: string | null;
          monto: number;
          moneda: Database['public']['Enums']['currency'];
          autorizo?: string | null;
          autorizador_id?: string | null;
          notas?: string | null;
          estado?: Database['public']['Enums']['reintegro_status'];
          deleted_at?: string | null;
        };
        Update: AuditUpdate & {
          fecha?: string;
          empresa?: string;
          tc_empresa?: string | null;
          card_id?: string;
          consumo_id?: string | null;
          monto?: number;
          moneda?: Database['public']['Enums']['currency'];
          autorizo?: string | null;
          autorizador_id?: string | null;
          notas?: string | null;
          estado?: Database['public']['Enums']['reintegro_status'];
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      pagos: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          serial: string | null;
          fecha: string;
          proveedor: string | null;
          proveedor_id: string | null;
          entidad: string | null;
          entidad_id: string | null;
          nit: string | null;
          concepto: string | null;
          monto: number;
          moneda: Database['public']['Enums']['currency'];
          cotizacion: number | null;
          pct_anticipo: number | null;
          pct_pendiente: number | null;
          tipo: Database['public']['Enums']['pago_tipo'];
          tipo_label: string | null;
          referencia: string | null;
          banco: string | null;
          autorizo: string | null;
          autorizador_id: string | null;
          notas: string | null;
          estado: Database['public']['Enums']['pago_estado'];
          consumo_id: string | null;
          step_idx: number;
          step_dates: string[];
          comprobante_storage_path: string | null;
          deleted_at: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          serial?: string | null;
          fecha: string;
          proveedor?: string | null;
          proveedor_id?: string | null;
          entidad?: string | null;
          entidad_id?: string | null;
          nit?: string | null;
          concepto?: string | null;
          monto: number;
          moneda?: Database['public']['Enums']['currency'];
          cotizacion?: number | null;
          pct_anticipo?: number | null;
          pct_pendiente?: number | null;
          tipo?: Database['public']['Enums']['pago_tipo'];
          tipo_label?: string | null;
          referencia?: string | null;
          banco?: string | null;
          autorizo?: string | null;
          autorizador_id?: string | null;
          notas?: string | null;
          estado?: Database['public']['Enums']['pago_estado'];
          consumo_id?: string | null;
          step_idx?: number;
          step_dates?: string[];
          comprobante_storage_path?: string | null;
          deleted_at?: string | null;
        };
        Update: AuditUpdate & {
          fecha?: string;
          proveedor?: string | null;
          proveedor_id?: string | null;
          entidad?: string | null;
          entidad_id?: string | null;
          nit?: string | null;
          concepto?: string | null;
          monto?: number;
          moneda?: Database['public']['Enums']['currency'];
          cotizacion?: number | null;
          pct_anticipo?: number | null;
          pct_pendiente?: number | null;
          tipo?: Database['public']['Enums']['pago_tipo'];
          tipo_label?: string | null;
          referencia?: string | null;
          banco?: string | null;
          autorizo?: string | null;
          autorizador_id?: string | null;
          notas?: string | null;
          estado?: Database['public']['Enums']['pago_estado'];
          consumo_id?: string | null;
          step_idx?: number;
          step_dates?: string[];
          comprobante_storage_path?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      vouchers: {
        Row: AuditCols & {
          id: string;
          legacy_id: number | null;
          serial: string | null;
          fecha: string;
          consumo_id: string | null;
          concepto: string | null;
          monto: number | null;
          moneda: Database['public']['Enums']['currency'] | null;
          estado: string | null;
          pagado_por: string | null;
          notas: string | null;
          deleted_at: string | null;
        };
        Insert: AuditInsert & {
          id?: string;
          legacy_id?: number | null;
          serial?: string | null;
          fecha: string;
          consumo_id?: string | null;
          concepto?: string | null;
          monto?: number | null;
          moneda?: Database['public']['Enums']['currency'] | null;
          estado?: string | null;
          pagado_por?: string | null;
          notas?: string | null;
          deleted_at?: string | null;
        };
        Update: AuditUpdate & {
          fecha?: string;
          consumo_id?: string | null;
          concepto?: string | null;
          monto?: number | null;
          moneda?: Database['public']['Enums']['currency'] | null;
          estado?: string | null;
          pagado_por?: string | null;
          notas?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      firma_miembros: {
        Row: {
          firma_id: string;
          miembro_id: string;
          created_at: string;
        };
        Insert: {
          firma_id: string;
          miembro_id: string;
        };
        Update: never;
        Relationships: [
          { foreignKeyName: 'firma_miembros_firma_id_fkey'; columns: ['firma_id']; referencedRelation: 'firmas'; referencedColumns: ['id'] },
          { foreignKeyName: 'firma_miembros_miembro_id_fkey'; columns: ['miembro_id']; referencedRelation: 'miembros_board'; referencedColumns: ['id'] },
        ];
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
      firma_status: 'en_espera' | 'firmado' | 'stand_by' | 'denegada';
      firma_urgencia: 'urgente' | 'importante' | 'programado';
      vale_status:
        | 'Creado'
        | 'Aprobado'
        | 'Liquidado'
        | 'Anulado'
        | 'EnLiquidacion'
        | 'Pagado'
        | 'Reintegrado'
        | 'Cancelado'
        | 'Solicitado'
        | 'Acreditado'
        | 'Asignado a Liquidación'
        | 'Pendiente de Liquidar'
        | 'Pendiente de Reintegro';
      reintegro_status: 'generada' | 'firmada' | 'presentada' | 'procesada' | 'reintegrada';
      pago_estado: 'Programado' | 'Aprobado' | 'Pagado' | 'Conciliado' | 'Anulado' | 'Devuelto';
      pago_tipo: 'transferencia' | 'cheque' | 'efectivo' | 'tarjeta' | 'otro';
      trip_type: 'personal' | 'trabajo' | 'familia' | 'salud' | 'otro';
      trip_status: 'planificado' | 'en_curso' | 'completado' | 'cancelado';
      evento_tipo: 'reunion' | 'cumpleanos' | 'aniversario' | 'viaje' | 'religioso' | 'otro';
    };
    CompositeTypes: Record<string, never>;
  };
};
