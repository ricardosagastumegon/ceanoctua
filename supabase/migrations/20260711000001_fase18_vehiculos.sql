-- Phase 18 · Catálogo Vehículos (flota de la empresa)
-- Spec en el prompt del usuario. NO es la tabla arriaza_autos (autos personales
-- de un miembro de la JD, que vive en fase 13 y no se toca).
--
-- Alcance de esta migración:
--   * Crear tabla `vehiculos` (catálogo nuevo en Admin)
--   * Índice único parcial sobre placa where deleted_at is null
--   * Trigger updated_at (helper set_updated_at de fase 1)
--   * Trigger audit_log (public.audit_trigger() de fase 3)
--   * RLS Pattern C (Catálogo) — cualquier auth lee, admin/asistente escribe
--
-- Ancla canonical: supabase/migrations/20260601000001_fase16_finanzas_f0_structural.sql
-- (status_solicitud_pago) para estructura + trigger updated_at + RLS.
--
-- Nota sobre audit_trigger: los otros catálogos (status_sp, empleados, entidades,
-- personas, etc.) NO tienen audit_trigger — solo lo tienen las 6 tablas
-- financieras según fase 3. Este catálogo SÍ lo lleva porque la Regla 0
-- (CLAUDE.md §4 invariante 10) dice "toda mutación queda en audit_log". Es una
-- divergencia intencional del patrón actual de catálogos.

BEGIN;

------------------------------------------------------------------
-- 1) Catálogo Vehículos
------------------------------------------------------------------
create table if not exists public.vehiculos (
  id          uuid primary key default gen_random_uuid(),
  marca       text not null,
  color       text,
  placa       text not null,
  tipo        text,
  uso         text,
  alias       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Índice único parcial: dos vehículos con la misma placa activa no pueden
-- coexistir, pero uno soft-deleted no bloquea a uno nuevo con la misma placa.
create unique index if not exists vehiculos_placa_activa_uidx
  on public.vehiculos (placa)
  where deleted_at is null;

-- Índice adicional para queries típicas del listado.
create index if not exists vehiculos_deleted_at_idx
  on public.vehiculos (deleted_at);

------------------------------------------------------------------
-- 2) Trigger updated_at (helper set_updated_at de fase 1)
------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (
      select 1 from pg_trigger where tgname = 'trg_vehiculos_updated_at'
    ) then
      execute 'create trigger trg_vehiculos_updated_at
               before update on public.vehiculos
               for each row execute function public.set_updated_at()';
    end if;
  end if;
end $$;

------------------------------------------------------------------
-- 3) Trigger audit_log (public.audit_trigger de fase 3)
--    Divergencia intencional del patrón de otros catálogos — ver header.
------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_proc where proname = 'audit_trigger') then
    if not exists (
      select 1 from pg_trigger where tgname = 'audit_vehiculos'
    ) then
      execute 'create trigger audit_vehiculos
               after insert or update or delete on public.vehiculos
               for each row execute function public.audit_trigger()';
    end if;
  end if;
end $$;

------------------------------------------------------------------
-- 4) RLS Pattern C · Catálogo
--    read: cualquier autenticado
--    write: admin + asistente
------------------------------------------------------------------
alter table public.vehiculos enable row level security;
drop policy if exists vehiculos_read on public.vehiculos;
drop policy if exists vehiculos_write on public.vehiculos;
create policy vehiculos_read on public.vehiculos
  for select using (auth.uid() is not null);
create policy vehiculos_write on public.vehiculos
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

COMMIT;

-- Forzar reload del schema cache de PostgREST (invariante 2 · CLAUDE.md §4).
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verificación post-migración (correr en SQL Editor)
-- ============================================================
--
-- 1. Estructura de la tabla:
--    \d public.vehiculos
--    -- debe listar 10 columnas
--
-- 2. RLS habilitado:
--    select tablename, rowsecurity from pg_tables
--     where schemaname='public' and tablename='vehiculos';
--    -- rowsecurity = true
--
-- 3. Policies presentes:
--    select policyname, cmd from pg_policies
--     where schemaname='public' and tablename='vehiculos';
--    -- vehiculos_read (SELECT) + vehiculos_write (ALL)
--
-- 4. Triggers:
--    select tgname from pg_trigger
--     where tgrelid = 'public.vehiculos'::regclass and not tgisinternal;
--    -- trg_vehiculos_updated_at + audit_vehiculos
--
-- 5. Insert como asistente (debe pasar):
--    insert into public.vehiculos (marca, placa) values ('Toyota', 'P123ABC');
--    -- debería crear la fila
--
-- 6. Verificar audit_log:
--    select tabla, accion, registro_id from public.audit_log
--     where tabla='vehiculos' order by created_at desc limit 1;
--    -- debe mostrar op='insert' con el id del vehículo recién creado
--
-- 7. Insert duplicado (debe fallar):
--    insert into public.vehiculos (marca, placa) values ('Nissan', 'P123ABC');
--    -- ERROR: duplicate key value violates unique constraint
--    -- "vehiculos_placa_activa_uidx"
--
-- 8. Soft delete + reuso de placa (debe pasar):
--    update public.vehiculos set deleted_at = now() where placa = 'P123ABC';
--    insert into public.vehiculos (marca, placa) values ('Nissan', 'P123ABC');
--    -- debería insertar sin error (el índice parcial ignora soft-deleted)
--
-- 9. Insert como anon (debe fallar):
--    set role anon;
--    insert into public.vehiculos (marca, placa) values ('X', 'PXX');
--    -- ERROR: new row violates row-level security policy
--    reset role;
