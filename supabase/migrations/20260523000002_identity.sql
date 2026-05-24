-- Phase 2 - Migration 0002
-- Identity & organisation tables.
-- Tables whose exact shape was not in PLAN-FASE-2.md are noted with
-- "ajustar contra el HTML"; review fields once the HTML is available.

-- Miembros del board -------------------------------------------------------
create table miembros_board (
  id          uuid primary key default gen_random_uuid(),
  codigo      text unique not null,                -- 'MAA','JA','LA',...
  nombre      text not null,
  rol         text,
  color       text,
  orden       int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Empleados (adminDB.empleados) -- ajustar contra el HTML
create table empleados (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,
  puesto      text,
  departamento text,
  empresa     text,
  email       text,
  telefono    text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Entidades (adminDB.entidades) -- ajustar contra el HTML
create table entidades (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,
  nit         text,
  direccion   text,
  contacto    text,
  telefono    text,
  email       text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Autorizadores (adminDB.autorizadores) -- ajustar contra el HTML
create table autorizadores (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,
  cargo       text,
  empresa     text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tipos de pago (adminDB.tipospago) -- ajustar contra el HTML
create table tipos_pago (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,                       -- 'transferencia','cheque',...
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Proveedores (fusion: aceProveedores + adminDB.proveedores)
create table proveedores (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  origen      text,                                -- 'ace' | 'admin'
  nombre      text not null,
  nit         text,
  contacto    text,
  telefono    text,
  email       text,
  direccion   text,
  rubro       text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Tarjetas de credito (fusion: tccorp + tcpres)
create table tarjetas_credito (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  tipo        tc_tipo not null,                    -- 'corporativa' | 'presidencia'
  tc_id       text not null,                       -- terminacion / identificador
  empresa     text,
  titular     text,
  red         text,                                -- VISA / Mastercard / Amex
  banco       text,
  nit         text,
  limite      text,
  direccion   text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index tarjetas_credito_tipo_idx on tarjetas_credito (tipo);
