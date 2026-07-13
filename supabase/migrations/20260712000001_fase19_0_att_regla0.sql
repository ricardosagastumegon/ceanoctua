-- Phase 19-0 · Regla 0 compliance para las 13 tablas att_* (módulo Arriaza T&T)
-- Objetivo: llevar el módulo T&T actual al estándar Regla 0 sin renombrar,
-- sin recrear y sin perder datos:
--   1) AuditCols uniformes: agregar created_by/updated_by a las 12 sub-tablas
--      que no los tenían (att_viajes ya los tiene desde fase 7).
--   2) Soft delete: agregar deleted_at timestamptz a las 13 tablas + índice
--      de apoyo para queries típicas de listado (filtro deleted_at is null).
--   3) audit_trigger de fase 3 (public.audit_trigger) adjunto a las 13 tablas.
--      Divergencia intencional del patrón antiguo de catálogos (ADR D-016
--      en docs/PROCESO-Y-DECISIONES.md). att_pins se incluye por uniformidad
--      aunque esté deprecada (comentario de fase 8).
--
-- NO renombra att_* → viaje_* (cosmético, fuera de F19-0).
-- NO toca RLS (las políticas existentes son correctas: Pattern C
-- admin+asistente en las 13 tablas — verificado en REPORTE-ESTADO-TT-ACTUAL.md §5).
-- NO borra el viaje "efqwrqe" ni ningún otro dato.
--
-- Idempotente: se puede correr N veces sin efectos duplicados.
--   - add column if not exists
--   - create index if not exists
--   - drop trigger if exists ... then create
--
-- Verificación post-migración (queries al final del archivo).

BEGIN;

-- ==============================================================
-- 1) Uniformar AuditCols en las 12 tablas que no tenían created_by/updated_by.
--    att_viajes ya los tiene desde fase 7, se salta.
-- ==============================================================
do $$
declare
  t text;
  tables_without_audit_cols text[] := array[
    'att_tickets',
    'att_hoteles',
    'att_restaurantes',
    'att_pins',
    'att_ticket_pax',
    'att_ticket_segments',
    'att_ticket_pay_records',
    'att_hotel_services',
    'att_hotel_pay_records',
    'att_restaurant_diners',
    'att_restaurant_services',
    'att_restaurant_pay_records'
  ];
begin
  foreach t in array tables_without_audit_cols loop
    execute format('alter table public.%I add column if not exists created_by uuid', t);
    execute format('alter table public.%I add column if not exists updated_by uuid', t);
  end loop;
end $$;

-- ==============================================================
-- 2) Soft delete: agregar deleted_at + índice a las 13 tablas.
-- ==============================================================
do $$
declare
  t text;
  att_tables text[] := array[
    'att_viajes',
    'att_tickets',
    'att_hoteles',
    'att_restaurantes',
    'att_pins',
    'att_ticket_pax',
    'att_ticket_segments',
    'att_ticket_pay_records',
    'att_hotel_services',
    'att_hotel_pay_records',
    'att_restaurant_diners',
    'att_restaurant_services',
    'att_restaurant_pay_records'
  ];
begin
  foreach t in array att_tables loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format(
      'create index if not exists %I on public.%I (deleted_at)',
      t || '_deleted_at_idx', t
    );
  end loop;
end $$;

-- ==============================================================
-- 3) Adjuntar audit_trigger a las 13 tablas.
--    Idempotente vía drop-then-create.
--    Divergencia intencional del patrón antiguo — ADR D-016.
-- ==============================================================
do $$
declare
  t text;
  trg text;
  att_tables text[] := array[
    'att_viajes',
    'att_tickets',
    'att_hoteles',
    'att_restaurantes',
    'att_pins',
    'att_ticket_pax',
    'att_ticket_segments',
    'att_ticket_pay_records',
    'att_hotel_services',
    'att_hotel_pay_records',
    'att_restaurant_diners',
    'att_restaurant_services',
    'att_restaurant_pay_records'
  ];
begin
  if not exists (select 1 from pg_proc where proname = 'audit_trigger') then
    raise exception 'audit_trigger() no existe — falta correr la migración fase 3 (20260524000004)';
  end if;
  foreach t in array att_tables loop
    trg := 'audit_' || t;
    execute format('drop trigger if exists %I on public.%I', trg, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()',
      trg, t
    );
  end loop;
end $$;

COMMIT;

-- Forzar reload del schema cache de PostgREST (invariante 2 · CLAUDE.md §4).
-- Sin esto, PostgREST sirve el schema viejo y la app rompe con
-- "Could not find the 'deleted_at' column of 'att_viajes' in the schema cache".
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verificación post-migración (correr en SQL Editor tras el Run)
-- ============================================================
--
-- 1) deleted_at agregado a las 13 tablas (debe devolver 13 filas):
--    select table_name from information_schema.columns
--     where table_schema='public'
--       and column_name='deleted_at'
--       and table_name like 'att_%'
--     order by table_name;
--
-- 2) created_by/updated_by uniformes (13 tablas × 2 columnas = 26 filas):
--    select table_name, column_name from information_schema.columns
--     where table_schema='public'
--       and column_name in ('created_by','updated_by')
--       and table_name like 'att_%'
--     order by table_name, column_name;
--
-- 3) audit_trigger adjunto a las 13 (debe listar 13 triggers `audit_att_*`):
--    select tgname, tgrelid::regclass as tabla
--      from pg_trigger
--     where tgname like 'audit_att_%'
--       and not tgisinternal
--     order by tgname;
--
-- 4) RLS intacta (Pattern C · admin+asistente en las 13 tablas — debe
--    verse rowsecurity=true y las políticas *_read/*_write):
--    select tablename, rowsecurity from pg_tables
--     where schemaname='public' and tablename like 'att_%'
--     order by tablename;
--    select tablename, policyname, cmd from pg_policies
--     where schemaname='public' and tablename like 'att_%'
--     order by tablename, policyname;
--
-- 5) "efqwrqe" NO tocado (deleted_at debe seguir NULL):
--    select id, titulo, estado, deleted_at from public.att_viajes
--     where titulo = 'efqwrqe';
--
-- 6) Prueba de audit_log (soft delete + insert):
--    -- crea un viaje de prueba
--    insert into public.att_viajes (titulo, estado) values ('test-audit', 'planificado')
--      returning id;
--    -- borra suave
--    update public.att_viajes set deleted_at = now() where titulo='test-audit';
--    -- lista los 3 eventos en audit_log (insert + update; el DELETE físico no ocurre)
--    select tabla, accion, registro_id, created_at, usuario_id
--      from public.audit_log
--     where tabla='att_viajes'
--       and datos_despues->>'titulo' = 'test-audit'
--        or datos_antes->>'titulo' = 'test-audit'
--     order by created_at desc
--     limit 5;
--    -- cleanup opcional (soft delete ya está aplicado, no hay que borrar físico)
