-- Phase 7 - CEA module
-- 1) cea_todos: rename texto->asunto, fecha_lim->fecha
-- 2) lavanderia: trim to plan fields (asunto, solicitado, descripcion)
-- 3) directorio: rename from cea_directorio + add unified fields
-- 4) firmas: drop and recreate with new shape + new enums
-- 5) firma_miembros: junction table for multi-select signers

-- ============================================================
-- 1) cea_todos
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='cea_todos' and column_name='texto')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cea_todos' and column_name='asunto') then
    alter table public.cea_todos rename column texto to asunto;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='cea_todos' and column_name='fecha_lim')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cea_todos' and column_name='fecha') then
    alter table public.cea_todos rename column fecha_lim to fecha;
  end if;
end;
$$;

-- ============================================================
-- 2) lavanderia
-- ============================================================
alter table public.lavanderia drop column if exists fecha;
alter table public.lavanderia drop column if exists prenda;
alter table public.lavanderia drop column if exists cantidad;
alter table public.lavanderia drop column if exists proveedor;
alter table public.lavanderia drop column if exists proveedor_id;
alter table public.lavanderia drop column if exists monto;
alter table public.lavanderia drop column if exists moneda;
alter table public.lavanderia drop column if exists estado;

alter table public.lavanderia add column if not exists asunto text;
alter table public.lavanderia add column if not exists solicitado text;
alter table public.lavanderia add column if not exists descripcion text;

-- ============================================================
-- 3) directorio (consolidacion: rename cea_directorio + add unified fields)
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='cea_directorio')
     and not exists (select 1 from information_schema.tables where table_schema='public' and table_name='directorio') then
    alter table public.cea_directorio rename to directorio;
  end if;
end;
$$;

alter table public.directorio add column if not exists tipo text;
alter table public.directorio add column if not exists razon text;
alter table public.directorio add column if not exists nit text;
alter table public.directorio add column if not exists giro text;
alter table public.directorio add column if not exists whatsapp text;
alter table public.directorio add column if not exists web text;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='directorio' and column_name='telefono')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='directorio' and column_name='tel') then
    alter table public.directorio rename column telefono to tel;
  end if;
end;
$$;

alter table public.directorio drop column if exists cargo;
alter table public.directorio drop column if exists empresa;

-- Policies were named after the old table; drop and recreate cleanly
drop policy if exists cea_directorio_read on public.directorio;
drop policy if exists cea_directorio_admin_write on public.directorio;
drop policy if exists directorio_read on public.directorio;
drop policy if exists directorio_write on public.directorio;

create policy directorio_read on public.directorio for select using (auth.uid() is not null);
create policy directorio_write on public.directorio for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

-- Re-attach updated_at trigger with the right name
drop trigger if exists set_updated_at_cea_directorio on public.directorio;
drop trigger if exists set_updated_at_directorio on public.directorio;
create trigger set_updated_at_directorio
  before update on public.directorio
  for each row execute function public.set_updated_at_with_by();

-- ============================================================
-- 4) firmas: drop & recreate
-- ============================================================
drop table if exists public.firmas cascade;
drop type if exists firma_status;

create type firma_status as enum ('en_espera','firmado','stand_by','denegada');

do $$ begin
  if not exists (select 1 from pg_type where typname='firma_urgencia') then
    create type firma_urgencia as enum ('urgente','importante','programado');
  end if;
end; $$;

create table public.firmas (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  recepcion       date,
  tipo            text not null,
  urgencia        firma_urgencia,
  justificacion   text,
  entregado       text,
  solicitado      text,
  status_firma    firma_status not null default 'en_espera',
  fecha_firma     date,
  fecha_entrega   date,
  quien_recibe    text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_by      uuid
);
create index firmas_status_idx on public.firmas(status_firma);
create index firmas_recepcion_idx on public.firmas(recepcion);
create index firmas_active_idx on public.firmas(deleted_at) where deleted_at is null;

alter table public.firmas enable row level security;

create policy firmas_read on public.firmas for select using (auth.uid() is not null);
create policy firmas_write on public.firmas for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

create trigger set_updated_at_firmas
  before update on public.firmas
  for each row execute function public.set_updated_at_with_by();

-- ============================================================
-- 5) firma_miembros (junction: many firmas <-> many miembros)
-- ============================================================
create table if not exists public.firma_miembros (
  firma_id   uuid not null references public.firmas(id) on delete cascade,
  miembro_id uuid not null references public.miembros_board(id) on delete cascade,
  primary key (firma_id, miembro_id),
  created_at timestamptz not null default now()
);
create index if not exists firma_miembros_miembro_idx on public.firma_miembros(miembro_id);

alter table public.firma_miembros enable row level security;

drop policy if exists firma_miembros_read on public.firma_miembros;
drop policy if exists firma_miembros_write on public.firma_miembros;
create policy firma_miembros_read on public.firma_miembros for select using (auth.uid() is not null);
create policy firma_miembros_write on public.firma_miembros for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));
