-- Phase 2 - Migration 0005
-- CEA operations: todos, firmas, lavanderia, directorio.
-- Shapes inferred from PLAN-FASE-2.md; ajustar contra el HTML.

create table cea_todos (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  texto       text not null,
  responsable text,
  empleado_id uuid references empleados(id),
  fecha_lim   date,
  prioridad   task_priority,
  estado      task_status not null default 'pendiente',
  done        boolean not null default false,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index cea_todos_estado_idx on cea_todos (estado);

create table firmas (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  fecha         date not null,
  documento     text,                              -- titulo/descripcion del doc
  empresa       text,
  consumo_id    uuid references tc_consumos(id),   -- ex 'linkedConsumo' / 'linkedFirmas'
  reintegro_id  uuid references reintegros(id),
  estado        firma_status not null default 'pendiente',
  notas         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index firmas_estado_idx   on firmas (estado);
create index firmas_consumo_idx  on firmas (consumo_id);

create table lavanderia (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  fecha       date not null,
  prenda      text not null,
  cantidad    int,
  proveedor   text,
  proveedor_id uuid references proveedores(id),
  monto       numeric(14,2),
  moneda      currency default 'GTQ',
  estado      text,                                -- 'enviado','recibido','pagado',...
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

create table cea_directorio (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,
  cargo       text,
  empresa     text,
  telefono    text,
  email       text,
  direccion   text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
