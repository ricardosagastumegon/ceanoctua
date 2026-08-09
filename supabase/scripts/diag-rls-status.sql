-- Diagnóstico URGENTE · 2026-08-09
-- Supabase Advisor reporta "Policy Exists RLS Disabled" en varias tablas.
-- Correr en Supabase Studio SQL Editor y compartir resultados.

-- ============================================================
-- 1) Estado real de RLS en TODAS las tablas de public
--    Columna importante: rowsecurity (true = RLS activo, false = deshabilitado)
-- ============================================================
select
  n.nspname as schema,
  c.relname as tabla,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as num_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'  -- solo tablas
order by
  case when c.relrowsecurity then 1 else 0 end,  -- primero las que NO tienen RLS
  c.relname;

-- ============================================================
-- 2) Tablas con POLICIES pero RLS DESHABILITADO
--    Estas son las críticas — el warning de Supabase Advisor apunta a estas
-- ============================================================
select
  t.tablename,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=t.tablename) as num_policies
from pg_tables t
join pg_class c on c.relname = t.tablename
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where t.schemaname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
  and exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t.tablename)
order by t.tablename;

-- ============================================================
-- 3) Últimos cambios en pg_class relacionados a RLS (audit trail)
--    Nota: PostgreSQL no logea cambios de relrowsecurity por default.
--    Este bloque muestra las tablas junto a la última vez que se hizo VACUUM
--    o ANALYZE — útil para ver qué se tocó recientemente (proxy imperfecto).
-- ============================================================
select
  c.relname,
  c.relrowsecurity,
  s.last_vacuum,
  s.last_autovacuum,
  s.last_analyze,
  s.last_autoanalyze
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relname = c.relname and s.schemaname='public'
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'att_%'
order by c.relname;
