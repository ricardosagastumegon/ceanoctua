-- Skill: check-rls-full · auditoría RLS de todas las tablas public.
-- Ver .claude/skills/check-rls-full.md
--
-- 3 reportes secuenciales — leer los resultados en Supabase Studio.

-- ============================================================
-- REPORTE A · CRÍTICO
-- Tablas con policies definidas pero RLS DESHABILITADO.
-- Anon key puede leer/escribir sin restricción.
-- Este es el escenario del incidente del 2026-08-09.
-- ============================================================
select
  c.relname as tabla,
  (select count(*) from pg_policies p
    where p.schemaname='public' and p.tablename=c.relname) as num_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
  and exists (
    select 1 from pg_policies p
    where p.schemaname='public' and p.tablename=c.relname
  )
order by c.relname;

-- ============================================================
-- REPORTE B
-- Tablas con RLS habilitado PERO sin policies (deniega todo por default).
-- Suele ser correcto para tablas append-only tipo audit_log, o error si
-- alguien olvidó agregar las policies.
-- ============================================================
select
  c.relname as tabla,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = true
  and not exists (
    select 1 from pg_policies p
    where p.schemaname='public' and p.tablename=c.relname
  )
order by c.relname;

-- ============================================================
-- REPORTE C
-- Tablas sin RLS habilitado NI policies.
-- Son tablas "públicas" por default — cualquier user con anon key puede
-- leer/escribir. Solo debería haber tablas técnicas de Supabase (ej.
-- schema_migrations) o intencionalmente públicas.
-- ============================================================
select
  c.relname as tabla
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
  and not exists (
    select 1 from pg_policies p
    where p.schemaname='public' and p.tablename=c.relname
  )
order by c.relname;

-- ============================================================
-- BONUS · Resumen general
-- ============================================================
select
  count(*) filter (where c.relrowsecurity = true) as rls_habilitadas,
  count(*) filter (where c.relrowsecurity = false) as rls_deshabilitadas,
  count(*) as total_tablas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
