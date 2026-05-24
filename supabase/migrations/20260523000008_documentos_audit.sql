-- Phase 2 - Migration 0008
-- Documentos (reemplaza los base64) y audit_log.

create table documentos (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  nombre        text not null,
  tipo_mime     text,
  tamano_bytes  bigint,
  storage_path  text not null,                     -- ruta en el bucket 'documentos'
  entidad_tipo  text,                              -- nombre de la tabla
  entidad_id    uuid,                              -- id del registro
  created_at    timestamptz not null default now(),
  created_by    uuid
);
create index documentos_entidad_idx on documentos (entidad_tipo, entidad_id);

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  tabla         text not null,
  registro_id   uuid,
  accion        text not null,                     -- 'insert' | 'update' | 'delete'
  usuario_id    uuid,
  datos_antes   jsonb,
  datos_despues jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_tabla_idx     on audit_log (tabla);
create index audit_log_registro_idx  on audit_log (registro_id);
create index audit_log_created_idx   on audit_log (created_at);
