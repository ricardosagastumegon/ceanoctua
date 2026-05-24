-- Phase 2 - Migration 0006
-- Miel SJ: constancias.
-- Shape inferred from PLAN-FASE-2.md; ajustar contra el HTML.

create table miel_constancias (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  correlativo   text unique,                       -- 'MSJ-0001' (de seq_miel_corr)
  fecha         date not null,
  cliente       text not null,
  nit           text,
  direccion     text,
  producto      text,
  presentacion  text,
  cantidad      numeric(12,3),
  unidad        text,
  precio_unit   numeric(14,2),
  monto_total   numeric(14,2),
  moneda        currency not null default 'GTQ',
  notas         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index miel_constancias_fecha_idx on miel_constancias (fecha);
